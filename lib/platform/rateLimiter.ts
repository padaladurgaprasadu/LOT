/**
 * LOT Platform Services - Sliding-Window Rate Limiter
 * In-memory sliding-window log rate limiter with microsecond timestamp tracking,
 * automatic garbage collection, and standard HTTP rate-limiting headers.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  totalLimit: number;
  // Backward compatibility fields for legacy callers
  resetInSec: number;
  limit: number;
  resetAt: number;
  retryAfterSec: number;
}

interface RateLimitBucket {
  timestamps: number[];
  lastAccessed: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Default configuration constants
export const DEFAULT_RATE_LIMIT = 30;
export const DEFAULT_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Check rate limit for a specific identifier using a sliding-window log algorithm.
 *
 * @param identifier Unique key (e.g. IP address, user ID, session ID)
 * @param limit Maximum allowed requests within the sliding window (default: 30)
 * @param windowMs Sliding window duration in milliseconds (default: 60,000ms / 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): RateLimitResult {
  const safeIdentifier = identifier && identifier.trim() ? identifier.trim() : "anonymous";
  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = rateLimitStore.get(safeIdentifier);

  if (!bucket) {
    bucket = {
      timestamps: [],
      lastAccessed: now,
    };
    rateLimitStore.set(safeIdentifier, bucket);
  }

  bucket.lastAccessed = now;

  // Prune expired timestamps older than the sliding window start
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length < limit) {
    bucket.timestamps.push(now);

    const remaining = Math.max(0, limit - bucket.timestamps.length);
    // Time until the oldest timestamp falls outside the sliding window
    const oldestTimestamp = bucket.timestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    const resetInSec = Math.max(1, Math.ceil(resetMs / 1000));

    return {
      allowed: true,
      remaining,
      resetMs,
      totalLimit: limit,
      resetInSec,
      limit,
      resetAt: now + resetMs,
      retryAfterSec: resetInSec,
    };
  }

  // Rate limit exceeded
  const oldestTimestamp = bucket.timestamps[0];
  const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
  const resetInSec = Math.max(1, Math.ceil(resetMs / 1000));

  return {
    allowed: false,
    remaining: 0,
    resetMs,
    totalLimit: limit,
    resetInSec,
    limit,
    resetAt: now + resetMs,
    retryAfterSec: resetInSec,
  };
}

/**
 * Generate standard RFC HTTP headers for rate limiting
 * (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const now = Date.now();
  const resetEpochSeconds = Math.ceil((now + result.resetMs) / 1000);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.totalLimit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(resetEpochSeconds),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSec || result.resetInSec);
  }

  return headers;
}

/**
 * Reset rate limit for a specific identifier (useful for tests or administrative resets)
 */
export function resetRateLimit(identifier: string): void {
  if (!identifier) return;
  rateLimitStore.delete(identifier.trim());
}

/**
 * Clear all tracked rate limit buckets
 */
export function clearRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Periodic cleanup of stale rate-limit buckets to prevent memory leaks.
 * Only runs in Node/server environments and uses .unref() to prevent holding the event loop.
 */
function scheduleStaleBucketCleanup(): void {
  if (typeof setInterval === "undefined") return;

  const timer = setInterval(() => {
    const now = Date.now();
    const maxRetentionMs = 5 * 60 * 1000; // 5 minutes inactivity

    rateLimitStore.forEach((bucket, key) => {
      if (now - bucket.lastAccessed > maxRetentionMs) {
        rateLimitStore.delete(key);
      }
    });
  }, 2 * 60 * 1000);

  if (typeof timer === "object" && typeof (timer as any).unref === "function") {
    (timer as any).unref();
  }
}

scheduleStaleBucketCleanup();
