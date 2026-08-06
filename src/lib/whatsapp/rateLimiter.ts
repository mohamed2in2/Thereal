interface PhoneOTPRecord {
  timestamps: number[];
}

class WhatsAppRateLimiter {
  private records: Map<string, PhoneOTPRecord> = new Map();
  private maxHourly: number = 5;
  private maxDaily: number = 20;
  private cooldownSeconds: number = 60;

  constructor(maxHourly = 5, maxDaily = 20, cooldownSeconds = 60) {
    this.maxHourly = maxHourly;
    this.maxDaily = maxDaily;
    this.cooldownSeconds = cooldownSeconds;
  }

  /**
   * Checks if an OTP request for a specific phone number is allowed.
   */
  public checkOTPRateLimit(phoneE164: string): { allowed: boolean; reason?: string; retryAfterSeconds?: number } {
    const now = Date.now();
    const record = this.records.get(phoneE164);

    if (!record || record.timestamps.length === 0) {
      return { allowed: true };
    }

    // Clean up timestamps older than 24 hours
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    record.timestamps = record.timestamps.filter((ts) => ts > oneDayAgo);

    const lastSend = record.timestamps[record.timestamps.length - 1];
    const timeSinceLast = Math.floor((now - lastSend) / 1000);

    // 1. Check 60s cooldown between requests from same phone
    if (timeSinceLast < this.cooldownSeconds) {
      const waitSeconds = this.cooldownSeconds - timeSinceLast;
      return {
        allowed: false,
        reason: `Please wait ${waitSeconds} seconds before requesting another verification code.`,
        retryAfterSeconds: waitSeconds,
      };
    }

    // 2. Check hourly limit (last 60 mins)
    const oneHourAgo = now - 60 * 60 * 1000;
    const hourlyCount = record.timestamps.filter((ts) => ts > oneHourAgo).length;

    if (hourlyCount >= this.maxHourly) {
      const oldestInHour = record.timestamps.find((ts) => ts > oneHourAgo) || now;
      const resetWait = Math.ceil((oldestInHour + 60 * 60 * 1000 - now) / 1000);
      return {
        allowed: false,
        reason: `Hourly OTP limit exceeded (${this.maxHourly}/hour). Try again later.`,
        retryAfterSeconds: resetWait > 0 ? resetWait : 60,
      };
    }

    // 3. Check daily limit (last 24 hours)
    if (record.timestamps.length >= this.maxDaily) {
      const oldestInDay = record.timestamps[0];
      const resetWait = Math.ceil((oldestInDay + 24 * 60 * 60 * 1000 - now) / 1000);
      return {
        allowed: false,
        reason: `Daily OTP limit exceeded (${this.maxDaily}/day). Try again tomorrow.`,
        retryAfterSeconds: resetWait > 0 ? resetWait : 3600,
      };
    }

    return { allowed: true };
  }

  /**
   * Records a successful OTP dispatch timestamp for a phone.
   */
  public recordOTPSend(phoneE164: string): void {
    const now = Date.now();
    let record = this.records.get(phoneE164);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(phoneE164, record);
    }
    record.timestamps.push(now);
  }
}

export const rateLimiter = new WhatsAppRateLimiter();
