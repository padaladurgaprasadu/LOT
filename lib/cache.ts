/**
 * LOT High-Speed In-Memory & Redis-Ready Cache
 * Eliminates redundant network hops and DB reads.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class FastLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxItems: number;
  private defaultTtlMs: number;

  constructor(maxItems = 1000, defaultTtlMs = 60 * 60 * 1000) {
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxItems) {
      // Evict oldest entry (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instances for entity hero images and common query responses
export const entityHeroCache = new FastLRUCache<{
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  description: string;
  source: string;
}>(500, 24 * 60 * 60 * 1000); // 24hr TTL for places and people

export const generalQueryCache = new FastLRUCache<string>(200, 10 * 60 * 1000); // 10 min TTL
