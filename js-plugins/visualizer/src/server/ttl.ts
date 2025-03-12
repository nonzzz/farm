export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export class ModuleCache<T> {
  private cache: Map<number, CacheItem<T>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 50, ttlInMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlInMs;
  }

  set(page: number, data: T): void {
    this.cleanup();

    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(page, {
      data,
      timestamp: Date.now()
    });
  }

  get(page: number): T | undefined {
    this.cleanup();
    const item = this.cache.get(page);

    if (!item) return undefined;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(page);
      return undefined;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}
