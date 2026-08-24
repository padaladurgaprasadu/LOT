/**
 * High-Speed In-Memory Response Cache for LOT AI
 * Caches complete generated responses in RAM.
 */

interface CachedResponse {
  content: string;
  hero?: any;
  timestamp: number;
}

class ResponseCache {
  private cache: Map<string, CachedResponse> = new Map();
  private maxEntries: number = 500;
  private ttlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  private normalizeKey(query: string, model: string): string {
    return `${model.trim().toLowerCase()}::${query.trim().toLowerCase().replace(/[?!.,]+$/, "")}`;
  }

  public get(query: string, model: string): CachedResponse | null {
    const key = this.normalizeKey(query, model);
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  public set(query: string, model: string, content: string, hero?: any): void {
    const key = this.normalizeKey(query, model);
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      content,
      hero,
      timestamp: Date.now(),
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const globalResponseCache = new ResponseCache();
