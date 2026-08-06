export type CacheTier = "Prompt" | "Knowledge" | "Retrieval" | "Response" | "Tool" | "Recommendation";

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  tier: CacheTier;
  expiresAt: number;
}

export class MultiTierCache {
  private static instance: MultiTierCache;
  private cache: Map<string, CacheEntry> = new Map();

  public static getInstance(): MultiTierCache {
    if (!MultiTierCache.instance) {
      MultiTierCache.instance = new MultiTierCache();
    }
    return MultiTierCache.instance;
  }

  public get<T>(tier: CacheTier, key: string): T | null {
    const compositeKey = `${tier}:${key}`;
    const entry = this.cache.get(compositeKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(compositeKey);
      return null;
    }

    return entry.data as T;
  }

  public set<T>(tier: CacheTier, key: string, data: T, ttlMs = 300000): void {
    const compositeKey = `${tier}:${key}`;
    this.cache.set(compositeKey, {
      key,
      data,
      tier,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clearTier(tier: CacheTier): void {
    for (const [k, v] of this.cache.entries()) {
      if (v.tier === tier) this.cache.delete(k);
    }
  }
}
