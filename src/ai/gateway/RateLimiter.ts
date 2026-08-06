export interface RateLimitStatus {
  allowed: boolean;
  remainingRequests: number;
  resetMs: number;
}

export class RateLimiter {
  private requestsMap: Map<string, number[]> = new Map();
  private maxRequestsPerWindow = 60; // 60 requests
  private windowMs = 60000; // 1 minute

  public checkRateLimit(key: string, limitOverride?: number): RateLimitStatus {
    const now = Date.now();
    const timestamps = this.requestsMap.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    const max = limitOverride || this.maxRequestsPerWindow;
    if (validTimestamps.length >= max) {
      const oldest = validTimestamps[0];
      const resetMs = this.windowMs - (now - oldest);
      return { allowed: false, remainingRequests: 0, resetMs };
    }

    validTimestamps.push(now);
    this.requestsMap.set(key, validTimestamps);

    return {
      allowed: true,
      remainingRequests: max - validTimestamps.length,
      resetMs: 0,
    };
  }
}
