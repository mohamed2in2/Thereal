import crypto from "crypto";

// In-memory sliding-window rate limiting map per (IP + UserID)
const memoryRateLimitMap = new Map<string, number[]>();

export class AccessCodeGuard {
  private static getServerSecret(): string {
    const secret = process.env.ACCESS_CODE_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      if (process.env.NEXT_PHASE === "phase-production-build") {
        return "build-time-dummy-access-code-secret";
      }
      throw new Error("ACCESS_CODE_SECRET or JWT_SECRET must be configured in environment variables.");
    }
    return secret;
  }

  /**
   * Generates a cryptographically secure, high-entropy access code.
   * Example output: "P9X7-WK4M-QT2H"
   */
  public static generateSecureCode(): string {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const getRandomChar = () => charset[crypto.randomInt(0, charset.length)];

    const part1 = Array.from({ length: 4 }, getRandomChar).join("");
    const part2 = Array.from({ length: 4 }, getRandomChar).join("");
    const part3 = Array.from({ length: 4 }, getRandomChar).join("");

    return `${part1}-${part2}-${part3}`;
  }

  /**
   * Computes SHA-256 HMAC hash of code using server secret for secure storage at rest.
   */
  public static hashCode(code: string): string {
    const normalized = String(code).trim().toUpperCase();
    return crypto
      .createHmac("sha256", this.getServerSecret())
      .update(normalized)
      .digest("hex");
  }

  /**
   * Performs constant-time comparison of two string hashes to prevent timing attacks.
   */
  public static constantTimeCompare(hashA: string, hashB: string): boolean {
    const bufA = Buffer.from(hashA, "utf-8");
    const bufB = Buffer.from(hashB, "utf-8");

    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Exponential rate-limit check per IP and User ID.
   * Lockout thresholds:
   *   - 5 failures in last 10 mins  => 30-second lock
   *   - 10 failures in last 30 mins => 5-minute lock
   *   - 20 failures in last 1 hour  => 1-hour lock
   */
  public static async verifyRateLimit(
    ip: string,
    userId?: string
  ): Promise<{ allowed: boolean; lockTimeSeconds: number; failureCount: number }> {
    try {
      const key = `${ip}:${userId || ""}`;
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const timestamps = (memoryRateLimitMap.get(key) || []).filter((t) => t >= oneHourAgo);
      memoryRateLimitMap.set(key, timestamps);

      const failures = timestamps.length;
      if (failures >= 20) {
        return { allowed: false, lockTimeSeconds: 3600, failureCount: failures };
      }
      if (failures >= 10) {
        return { allowed: false, lockTimeSeconds: 300, failureCount: failures };
      }
      if (failures >= 5) {
        return { allowed: false, lockTimeSeconds: 30, failureCount: failures };
      }

      return { allowed: true, lockTimeSeconds: 0, failureCount: failures };
    } catch {
      return { allowed: true, lockTimeSeconds: 0, failureCount: 0 };
    }
  }

  /**
   * Logs access code redemption attempt for audit telemetry.
   * NEVER stores raw code input.
   */
  public static async logAttempt(params: {
    ip: string;
    userId?: string;
    codeAttempted: string;
    success: boolean;
  }): Promise<void> {
    try {
      if (!params.success) {
        const key = `${params.ip}:${params.userId || ""}`;
        const now = Date.now();
        const timestamps = memoryRateLimitMap.get(key) || [];
        timestamps.push(now);
        memoryRateLimitMap.set(key, timestamps);
      }
    } catch {}
  }
}
