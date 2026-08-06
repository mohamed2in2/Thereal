import { prisma } from "@/lib/prisma";
import { OtpQuotaManager, OtpActionCategory } from "./OtpQuotaManager";
import { sendVerificationSms } from "@/lib/aws-sms";
import { createPhoneVerificationChallenge, setPhoneVerificationCookie } from "@/lib/auth";

export interface RequestOtpParams {
  userId?: string;
  phone: string;
  actionCategory: OtpActionCategory;
}

export interface RequestOtpResult {
  sent: boolean;
  deferred: boolean;
  code?: string;
  message: string;
  quotaRemaining: number;
}

const ACTION_PRIORITY: Record<OtpActionCategory, number> = {
  PASSWORD_RESET: 1,  // Highest priority
  COURSE_PURCHASE: 2,
  CODE_REDEMPTION: 3,
  PHONE_CHANGE: 4,
  SIGNUP: 5,          // Lowest priority
};

export class OtpService {
  /**
   * Request OTP dispatch.
   * If daily WhatsApp quota (< 250) is available:
   *   - Atomically reserves quota slot and dispatches SMS/WhatsApp.
   * If daily quota is exhausted:
   *   - Defers verification, enqueues request into OtpQueueItem with priority ranking,
   *     and returns deferred status so user profile can proceed in unverified mode.
   */
  public static async requestOtp(params: RequestOtpParams): Promise<RequestOtpResult> {
    const { userId, phone, actionCategory } = params;

    // 1. Reserve quota slot atomically
    const quotaRes = await OtpQuotaManager.reserveQuota(actionCategory);

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (quotaRes.allowed) {
      // Quota available -> Send WhatsApp OTP immediately
      try {
        await sendVerificationSms(phone, otpCode);
        const challengeToken = await createPhoneVerificationChallenge(phone, otpCode);
        await setPhoneVerificationCookie(challengeToken);

        return {
          sent: true,
          deferred: false,
          code: otpCode,
          message: "تم إرسال رمز التحقق عبر WhatsApp بنجاح",
          quotaRemaining: quotaRes.remaining,
        };
      } catch (err) {
        console.error("[OtpService] Failed to send WhatsApp OTP:", err);
        // Release reserved quota slot so unused quota isn't wasted
        await OtpQuotaManager.releaseQuota(actionCategory);
      }
    }

    // 2. Daily quota exhausted OR provider call failed -> Defer verification
    if (userId) {
      const priority = ACTION_PRIORITY[actionCategory] ?? 5;

      await prisma.otpQueueItem.create({
        data: {
          userId,
          phone,
          actionType: actionCategory,
          priority,
          status: "QUEUED",
        },
      });

      // Update user verification status to WAITING_FOR_OTP
      await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: false,
          verificationStatus: "WAITING_FOR_OTP",
        },
      });
    }

    return {
      sent: false,
      deferred: true,
      message: "تم بلوغ الحد اليومي لرسائل التحقق السريعة. تم إدراج طلبك في قائمة الانتظار، ويمكنك متابعة استخدام حسابك الآن.",
      quotaRemaining: 0,
    };
  }

  /**
   * Worker method called by cron or admin trigger to process queued OTP items
   * whenever daily quota becomes available.
   */
  public static async processQueuedOtps(maxBatchSize: number = 20): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    let sentCount = 0;
    let failedCount = 0;

    // Fetch queued items ordered by priority (1 highest) and queue timestamp
    const queuedItems = await prisma.otpQueueItem.findMany({
      where: { status: "QUEUED" },
      orderBy: [{ priority: "asc" }, { queuedAt: "asc" }],
      take: maxBatchSize,
    });

    for (const item of queuedItems) {
      // Check quota reservation for item's action
      const quotaRes = await OtpQuotaManager.reserveQuota(item.actionType as OtpActionCategory);
      if (!quotaRes.allowed) {
        // Quota still exhausted -> Stop processing batch
        break;
      }

      try {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await sendVerificationSms(item.phone, otpCode);

        // Update queue item
        await prisma.otpQueueItem.update({
          where: { id: item.id },
          data: {
            status: "SENT",
            processedAt: new Date(),
          },
        });

        // Update user to VERIFIED
        await prisma.user.update({
          where: { id: item.userId },
          data: {
            isVerified: true,
            verificationStatus: "VERIFIED",
          },
        });

        sentCount++;
      } catch (err) {
        console.error(`[OtpService] Processing queued item ${item.id} failed:`, err);
        failedCount++;

        await prisma.otpQueueItem.update({
          where: { id: item.id },
          data: {
            retryCount: { increment: 1 },
            status: item.retryCount >= 3 ? "FAILED" : "QUEUED",
          },
        });
      }
    }

    return {
      processed: queuedItems.length,
      sent: sentCount,
      failed: failedCount,
    };
  }
}
