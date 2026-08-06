import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OtpQuotaManager } from "@/services/otp/OtpQuotaManager";
import { ReferralService } from "@/services/referral/ReferralService";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // 1. Fetch OTP Quota Telemetry
    const otpQuotaStats = await OtpQuotaManager.getTodayQuotaStats();

    // 2. Fetch OTP Queue Telemetry
    const [queuedOtpCount, waitingUsersCount, failedOtpCount] = await Promise.all([
      prisma.otpQueueItem.count({ where: { status: "QUEUED" } }),
      prisma.user.count({ where: { verificationStatus: "WAITING_FOR_OTP" } }),
      prisma.otpQueueItem.count({ where: { status: "FAILED" } }),
    ]);

    // 3. Fetch Referral Telemetry
    const referralStats = await ReferralService.getReferralTelemetry();

    // 4. Fetch Access Code Security Telemetry (Last 24 Hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [failedCodeAttempts, recentCodeLogs] = await Promise.all([
      prisma.accessCodeLog.count({
        where: { success: false, createdAt: { gte: twentyFourHoursAgo } },
      }),
      prisma.accessCodeLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    // 5. Fetch Recent Audit Logs
    const recentAuditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    // 6. Compute System Security Health Indicators
    const otpHealth = otpQuotaStats.used >= 240 ? "CRITICAL" : otpQuotaStats.used >= 200 ? "WARNING" : "HEALTHY";
    const queueHealth = waitingUsersCount > 50 ? "CRITICAL" : waitingUsersCount > 10 ? "WARNING" : "HEALTHY";
    const codeSecurityHealth = failedCodeAttempts > 50 ? "CRITICAL" : failedCodeAttempts > 15 ? "WARNING" : "HEALTHY";
    const referralHealth = referralStats.invalid > 10 ? "WARNING" : "HEALTHY";

    return NextResponse.json({
      health: {
        otpHealth,
        queueHealth,
        codeSecurityHealth,
        referralHealth,
      },
      otp: {
        quota: otpQuotaStats,
        queue: {
          queuedCount: queuedOtpCount,
          waitingUsersCount,
          failedCount: failedOtpCount,
        },
      },
      referrals: referralStats,
      security: {
        failedCodeAttempts24h: failedCodeAttempts,
        recentLogs: recentCodeLogs,
        auditLogs: recentAuditLogs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin Security Telemetry Error]:", error);
    return NextResponse.json({ error: "حدث خطأ في تحميل إحصائيات الأمان" }, { status: 500 });
  }
}
