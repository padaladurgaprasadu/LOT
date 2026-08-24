interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Sliding window in-memory rate limiter
 * @param key Identifier (e.g. IP + endpoint)
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSec: Math.ceil(windowMs / 1000),
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetInSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

// Cleanup stale entries every 5 minutes using forEach
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((v, k) => {
    if (now > v.resetAt) {
      rateLimitMap.delete(k);
    }
  });
}, 5 * 60 * 1000);
