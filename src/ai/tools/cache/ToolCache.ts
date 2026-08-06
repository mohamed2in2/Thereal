import { ToolExecutionResult } from "../types";

interface CacheEntry {
  result: ToolExecutionResult;
  expiresAt: number;
}

export class ToolCache {
  private static instance: ToolCache;
  private cache: Map<string, CacheEntry> = new Map();

  public static getInstance(): ToolCache {
    if (!ToolCache.instance) {
      ToolCache.instance = new ToolCache();
    }
    return ToolCache.instance;
  }

  public get(key: string): ToolExecutionResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return { ...entry.result, fromCache: true };
  }

  public set(key: string, result: ToolExecutionResult, ttlMs = 300000): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public invalidate(prefixOrKey: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(prefixOrKey)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}
