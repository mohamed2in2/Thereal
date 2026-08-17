/**
 * Code-UP In-Memory L1 Cache Layer
 * Provides high-throughput, low-latency caching for read-heavy entities
 * (Course Outlines, Platform Config, Session Token Versions) to protect
 * PostgreSQL and CPU during peak student traffic.
 *
 * All operations fail-safe: if cache lookup misses or fails, it falls back
 * directly to the authoritative database fetch.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxItems: number;

  constructor(maxItems = 3000) {
    this.maxItems = maxItems;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    // Evict oldest entry if max items exceeded
    if (this.store.size >= this.maxItems) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clearPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Global singletons for App Server memory space
const courseMemoryCache = new MemoryCache(500);
const authSessionMemoryCache = new MemoryCache(5000);

// ── Course Outline Cache (Pillar 3) ─────────────────────────────────────────
const COURSE_OUTLINE_TTL_MS = 60 * 1000; // 60 seconds TTL

export async function getCachedCourseOutline<T>(
  courseId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const key = `course:${courseId}`;
  const cached = courseMemoryCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const fresh = await fetchFn();
  if (fresh) {
    courseMemoryCache.set(key, fresh, COURSE_OUTLINE_TTL_MS);
  }
  return fresh;
}

export function invalidateCourseCache(courseId?: string): void {
  if (courseId) {
    courseMemoryCache.delete(`course:${courseId}`);
  } else {
    courseMemoryCache.clearPrefix("course:");
  }
}

// ── Session Token Version Cache (Pillar 4) ──────────────────────────────────
// Keeps JWT tokenVersion & active status checks fast (<0.01ms) while guaranteeing
// immediate revocation propagation within 10s.
const TOKEN_VERSION_TTL_MS = 10 * 1000; // 10 seconds TTL

export async function getCachedUserSession<T>(
  userId: string,
  fetchFn: () => Promise<T | null>
): Promise<T | null> {
  const key = `user_sess:${userId}`;
  const cached = authSessionMemoryCache.get<T | null>(key);
  if (cached !== undefined) {
    return cached;
  }

  const fresh = await fetchFn();
  authSessionMemoryCache.set(key, fresh, TOKEN_VERSION_TTL_MS);
  return fresh;
}

export function invalidateUserSessionCache(userId?: string): void {
  if (userId) {
    authSessionMemoryCache.delete(`user_sess:${userId}`);
  } else {
    authSessionMemoryCache.clearPrefix("user_sess:");
  }
}
