import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHA7NAWY_PENDING_TYPE } from "@/lib/sha7nawy";
import { SHAKEOUT_PENDING_TYPE } from "@/lib/shakeout";

async function handleCleanup(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const sha7nawyCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours
    const shakeoutCutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days (7-day invoice + 1 day grace)
    const challengeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    const [sha7nawyRes, shakeoutRes, challengeRes] = await Promise.all([
      prisma.balanceTransaction.updateMany({
        where: {
          type: SHA7NAWY_PENDING_TYPE,
          createdAt: { lt: sha7nawyCutoff },
        },
        data: {
          type: "credit_sha7nawy_expired",
        },
      }),
      prisma.balanceTransaction.updateMany({
        where: {
          type: SHAKEOUT_PENDING_TYPE,
          createdAt: { lt: shakeoutCutoff },
        },
        data: {
          type: "credit_shakeout_expired",
        },
      }),
      prisma.phoneVerificationChallenge.deleteMany({
        where: {
          OR: [
            { consumedAt: { not: null }, createdAt: { lt: challengeCutoff } },
            { expiresAt: { lt: challengeCutoff } },
          ],
        },
      }),
    ]);

    const totalExpired = sha7nawyRes.count + shakeoutRes.count;

    return NextResponse.json({
      success: true,
      expiredCount: totalExpired,
      sha7nawyExpired: sha7nawyRes.count,
      shakeoutExpired: shakeoutRes.count,
      challengesCleaned: challengeRes.count,
      sha7nawyCutoff: sha7nawyCutoff.toISOString(),
      shakeoutCutoff: shakeoutCutoff.toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron Expire Payments] Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تنظيف الفواتير المنتهية" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleCleanup(req);
}

export async function POST(req: NextRequest) {
  return handleCleanup(req);
}

