interface RateRecord {
  count: number;
  resetAt: number;
}

class PaymentRateLimiter {
  private userMap = new Map<string, RateRecord>();
  private readonly windowMs = 60 * 60 * 1000; // 1 hour
  private readonly maxRequests = 10;           // 10 creations / hour

  public checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    const record = this.userMap.get(userId);

    if (!record || now > record.resetAt) {
      this.userMap.set(userId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, remaining: this.maxRequests - 1, resetInSeconds: 3600 };
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

  public cleanup() {
    const now = Date.now();
    for (const [userId, record] of this.userMap.entries()) {
      if (now > record.resetAt) {
        this.userMap.delete(userId);
      }
    }
  }
}

export const paymentRateLimiter = new PaymentRateLimiter();

if (typeof setInterval !== "undefined") {
  setInterval(() => paymentRateLimiter.cleanup(), 15 * 60 * 1000);
}
