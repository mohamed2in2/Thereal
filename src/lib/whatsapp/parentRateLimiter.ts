interface RateRecord {
  count: number;
  resetAt: number;
}

class ParentRateLimiter {
  private ipMap = new Map<string, RateRecord>();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 30;     // 30 requests / minute

  public checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    const record = this.ipMap.get(ip);

    if (!record || now > record.resetAt) {
      this.ipMap.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, remaining: this.maxRequests - 1, resetInSeconds: 60 };
    }

    if (record.count >= this.maxRequests) {
      const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, resetInSeconds };
    }

    record.count += 1;
    const remaining = this.maxRequests - record.count;
    const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);

    return { allowed: true, remaining, resetInSeconds };
  }

  /**
   * Cleanup expired IP entries periodically
   */
  public cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.ipMap.entries()) {
      if (now > record.resetAt) {
        this.ipMap.delete(ip);
      }
    }
  }
}

export const parentRateLimiter = new ParentRateLimiter();

// Run periodic cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => parentRateLimiter.cleanup(), 5 * 60 * 1000);
}
