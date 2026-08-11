import { prisma } from "@/lib/prisma";

export type OtpActionCategory =
  | "SIGNUP"
  | "PASSWORD_RESET"
  | "COURSE_PURCHASE"
  | "PHONE_CHANGE"
  | "CODE_REDEMPTION";

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
}

export class OtpQuotaManager {
  /**
   * Returns Cairo calendar date string YYYY-MM-DD.
   */
  public static getCairoTodayStr(date: Date = new Date()): string {
    return date.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  }

  /**
   * Atomically checks and reserves daily WhatsApp OTP quota inside a transaction.
   * Hard limit: 250 calls per Cairo calendar day.
   */
  public static async reserveQuota(
    category: OtpActionCategory,
    limit: number = 250
  ): Promise<QuotaCheckResult> {
    const todayStr = this.getCairoTodayStr();

    return await prisma.$transaction(async (tx: any) => {
      // Find or create today's quota record
      let quotaRecord = await tx.otpQuota.findUnique({
        where: { date: todayStr },
      });

      if (!quotaRecord) {
        quotaRecord = await tx.otpQuota.create({
          data: {
            date: todayStr,
            limit,
            used: 0,
          },
        });
      }

      // Reserve 30 OTPs strictly for PASSWORD_RESET so users can ALWAYS recover accounts
      const PASSWORD_RESET_RESERVED = 30;
      const generalLimit = quotaRecord.limit - PASSWORD_RESET_RESERVED; // 220 for general use

      if (category !== "PASSWORD_RESET" && quotaRecord.used >= generalLimit) {
        return {
          allowed: false,
          used: quotaRecord.used,
          remaining: 0,
          limit: quotaRecord.limit,
        };
      }

      if (quotaRecord.used >= quotaRecord.limit) {
        return {
          allowed: false,
          used: quotaRecord.used,
          remaining: 0,
          limit: quotaRecord.limit,
        };
      }

      // Map action category to column field
      const categoryFieldMap: Record<OtpActionCategory, string> = {
        SIGNUP: "signupUsed",
        PASSWORD_RESET: "forgotPasswordUsed",
        COURSE_PURCHASE: "purchaseUsed",
        PHONE_CHANGE: "phoneChangeUsed",
        CODE_REDEMPTION: "codeRedemptionUsed",
      };

      const categoryField = categoryFieldMap[category] || "signupUsed";

      // Atomically increment quota
      const updated = await tx.otpQuota.update({
        where: { id: quotaRecord.id },
        data: {
          used: { increment: 1 },
          [categoryField]: { increment: 1 },
        },
      });

      return {
        allowed: true,
        used: updated.used,
        remaining: Math.max(0, updated.limit - updated.used),
        limit: updated.limit,
      };
    });
  }

  /**
   * Releases a reserved OTP quota slot if the WhatsApp provider call fails.
   */
  public static async releaseQuota(category: OtpActionCategory): Promise<void> {
    const todayStr = this.getCairoTodayStr();
    const categoryFieldMap: Record<OtpActionCategory, string> = {
      SIGNUP: "signupUsed",
      PASSWORD_RESET: "forgotPasswordUsed",
      COURSE_PURCHASE: "purchaseUsed",
      PHONE_CHANGE: "phoneChangeUsed",
      CODE_REDEMPTION: "codeRedemptionUsed",
    };

    const categoryField = categoryFieldMap[category] || "signupUsed";

    await prisma.otpQuota.updateMany({
      where: { date: todayStr, used: { gt: 0 } },
      data: {
        used: { decrement: 1 },
        [categoryField]: { decrement: 1 },
      },
    }).catch(() => {});
  }

  /**
   * Queries today's current OTP quota status without incrementing.
   */
  public static async getTodayQuotaStats(): Promise<{
    date: string;
    used: number;
    remaining: number;
    limit: number;
    signupUsed: number;
    forgotPasswordUsed: number;
    purchaseUsed: number;
    phoneChangeUsed: number;
    codeRedemptionUsed: number;
  }> {
    const todayStr = this.getCairoTodayStr();
    const quota = await prisma.otpQuota.findUnique({
      where: { date: todayStr },
    });

    const limit = quota?.limit ?? 250;
    const used = quota?.used ?? 0;

    return {
      date: todayStr,
      used,
      remaining: Math.max(0, limit - used),
      limit,
      signupUsed: quota?.signupUsed ?? 0,
      forgotPasswordUsed: quota?.forgotPasswordUsed ?? 0,
      purchaseUsed: quota?.purchaseUsed ?? 0,
      phoneChangeUsed: quota?.phoneChangeUsed ?? 0,
      codeRedemptionUsed: quota?.codeRedemptionUsed ?? 0,
    };
  }
}
