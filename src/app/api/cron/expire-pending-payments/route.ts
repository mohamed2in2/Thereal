import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHA7NAWY_PENDING_TYPE } from "@/lib/sha7nawy";
import { SHAKEOUT_PENDING_TYPE } from "@/lib/shakeout";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [sha7nawyRes, shakeoutRes] = await Promise.all([
      prisma.balanceTransaction.updateMany({
        where: {
          type: SHA7NAWY_PENDING_TYPE,
          createdAt: { lt: cutoffDate },
        },
        data: {
          type: "credit_sha7nawy_expired",
        },
      }),
      prisma.balanceTransaction.updateMany({
        where: {
          type: SHAKEOUT_PENDING_TYPE,
          createdAt: { lt: cutoffDate },
        },
        data: {
          type: "credit_shakeout_expired",
        },
      }),
    ]);

    const totalExpired = sha7nawyRes.count + shakeoutRes.count;

    return NextResponse.json({
      success: true,
      expiredCount: totalExpired,
      sha7nawyExpired: sha7nawyRes.count,
      shakeoutExpired: shakeoutRes.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron Expire Payments] Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تنظيف الفواتير المنتهية" }, { status: 500 });
  }
}
