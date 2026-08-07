import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { SHA7NAWY_PENDING_TYPE, SHA7NAWY_CREDITED_TYPE } from "@/lib/sha7nawy";
import { SHAKEOUT_PENDING_TYPE, SHAKEOUT_CREDITED_TYPE } from "@/lib/shakeout";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 1. Pending payments older than 1 hour, oldest first
    const stalePending = await prisma.balanceTransaction.findMany({
      where: {
        type: { in: [SHA7NAWY_PENDING_TYPE, SHAKEOUT_PENDING_TYPE] },
        createdAt: { lt: oneHourAgo },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        userId: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
        user: { select: { name: true, phone: true, email: true } },
      },
    });

    // 2. Audit ledger drift across active users (where User.balance != sum of settled transactions)
    const usersWithBalance = await prisma.user.findMany({
      where: { balance: { gt: 0 } },
      select: { id: true, name: true, phone: true, balance: true },
    });

    const userDriftList = [];

    for (const u of usersWithBalance) {
      const settledSumResult = await prisma.balanceTransaction.aggregate({
        where: {
          userId: u.id,
          type: { notIn: [SHA7NAWY_PENDING_TYPE, SHAKEOUT_PENDING_TYPE, "credit_sha7nawy_expired", "credit_shakeout_expired"] },
        },
        _sum: { amount: true },
      });

      const settledSum = settledSumResult._sum.amount ?? 0;
      const drift = Math.abs(u.balance - settledSum);

      if (drift > 0.01) {
        userDriftList.push({
          userId: u.id,
          name: u.name,
          phone: u.phone,
          userBalance: u.balance,
          ledgerSum: settledSum,
          driftAmount: drift,
        });
      }
    }

    // 3. Totals summary
    const [pendingCount, creditedCount, expiredCount] = await Promise.all([
      prisma.balanceTransaction.count({
        where: { type: { in: [SHA7NAWY_PENDING_TYPE, SHAKEOUT_PENDING_TYPE] } },
      }),
      prisma.balanceTransaction.count({
        where: { type: { in: [SHA7NAWY_CREDITED_TYPE, SHAKEOUT_CREDITED_TYPE] } },
      }),
      prisma.balanceTransaction.count({
        where: { type: { in: ["credit_sha7nawy_expired", "credit_shakeout_expired"] } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stalePending,
      userDriftList,
      summary: {
        pendingCount,
        creditedCount,
        expiredCount,
        stalePendingCount: stalePending.length,
        driftUserCount: userDriftList.length,
      },
    });
  } catch (error: any) {
    console.error("[Superadmin Reconciliation] Error:", error);
    return NextResponse.json({ error: "تعذر جلب تسوية المدفوعات" }, { status: 500 });
  }
}
