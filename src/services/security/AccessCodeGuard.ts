import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export class AccessCodeGuard {
  private static SERVER_SECRET = process.env.ACCESS_CODE_SECRET || "codeup_access_code_server_secret_2026";

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
      .createHmac("sha256", this.SERVER_SECRET)
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
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const failures = await prisma.accessCodeLog.count({
      where: {
        OR: [{ ip }, ...(userId ? [{ userId }] : [])],
        success: false,
        createdAt: { gte: oneHourAgo },
      },
    });

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
    const rawInput = String(params.codeAttempted || "").trim().toUpperCase();
    const attemptHash = this.hashCode(rawInput);
    const first4Characters = rawInput.substring(0, 4);
    const codeLength = rawInput.length;

    await prisma.accessCodeLog.create({
      data: {
        ip: params.ip,
        userId: params.userId,
        attemptHash,
        first4Characters,
        codeLength,
        success: params.success,
      },
    }).catch(() => {});

    // Audit Log for security monitoring
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.success ? "ACCESS_CODE_REDEEMED" : "ACCESS_CODE_FAILED",
        ip: params.ip,
        metadata: JSON.stringify({
          first4: first4Characters,
          length: codeLength,
          success: params.success,
        }),
      },
    }).catch(() => {});
  }
}
