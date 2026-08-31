import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getShakeOutPaymentInfo,
  SHAKEOUT_PENDING_TYPE,
  SHAKEOUT_CREDITED_TYPE,
  SHAKEOUT_PAID_STATUSES,
} from "@/lib/shakeout";
import {
  getSha7nawyPaymentInfo,
  SHA7NAWY_PENDING_TYPE,
  SHA7NAWY_CREDITED_TYPE,
  SHA7NAWY_PAID_STATUSES,
} from "@/lib/sha7nawy";
import { fulfillPendingItemPurchase } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

/**
 * Superadmin / Admin: Real-time sync and auto-reconciliation of payment gateway transactions.
 * Queries Shake-Out (Fawry / Card) and Sha7nawy (Mobile Wallets) to verify live status
 * and auto-fulfills/credits any completed payments.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["superadmin", "admin", "staff"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find all pending and recent expired transactions
    const candidateTxs = await prisma.balanceTransaction.findMany({
      where: {
        OR: [
          { type: { in: [SHAKEOUT_PENDING_TYPE, SHA7NAWY_PENDING_TYPE] } },
          {
            type: { in: ["credit_shakeout_expired", "credit_sha7nawy_expired"] },
            createdAt: { gte: sevenDaysAgo },
          },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const reconciled: Array<{
      id: string;
      studentName: string;
      studentPhone: string | null;
      amount: number;
      provider: string;
      reference: string;
      itemName?: string;
    }> = [];

    for (const tx of candidateTxs) {
      const isShakeOut = tx.type.includes("shakeout");
      const isSha7nawy = tx.type.includes("sha7nawy");

      if (isShakeOut) {
        const refMatch = tx.note?.match(/shakeout_ref:([^\s|]+)/);
        const invIdMatch = tx.note?.match(/inv_id:([^\s|]+)/);
        const invRefMatch = tx.note?.match(/inv_ref:([^\s|]+)/);

        const ref = refMatch ? refMatch[1] : (tx.providerRef || "");
        const invId = invIdMatch ? invIdMatch[1] : (ref.split("/")[0] || "");
        const invRef = invRefMatch ? invRefMatch[1] : (ref.split("/")[1] || "");

        if (!invId) continue;

        try {
          const gatewayInfo = await getShakeOutPaymentInfo(invId, invRef);
          const rawStatus = (gatewayInfo.data?.status || "unknown").toString().toLowerCase();
          const isPaid = SHAKEOUT_PAID_STATUSES.includes(rawStatus);

          if (isPaid) {
            const targetType = tx.type;
            const isLate = targetType === "credit_shakeout_expired";

            let fulfillmentRes: any = null;
            const success = await prisma.$transaction(
              async (db) => {
                const claim = await db.balanceTransaction.updateMany({
                  where: { id: tx.id, type: targetType },
                  data: {
                    type: SHAKEOUT_CREDITED_TYPE,
                    note: `${tx.note} — سداد عبر Shake-Out (تحديث شامل Brutal Refresh)${isLate ? " (دفع متأخر)" : ""}`,
                  },
                });

                if (claim.count === 0) return false;

                await db.user.update({
                  where: { id: tx.userId },
                  data: { balance: { increment: tx.amount } },
                });

                fulfillmentRes = await fulfillPendingItemPurchase({
                  userId: tx.userId,
                  note: tx.note,
                  tx: db,
                });

                return true;
              },
              { timeout: 20000, maxWait: 10000 }
            );

            if (success) {
              reconciled.push({
                id: tx.id,
                studentName: tx.user?.name || "طالب",
                studentPhone: tx.user?.phone || null,
                amount: tx.amount,
                provider: "Shake-Out (Fawry / بطاقة)",
                reference: ref,
                itemName: fulfillmentRes?.itemName || "اشتراك/كورس",
              });
            }
          }
        } catch (err) {
          console.warn(`[SyncPayments] Error checking ShakeOut tx ${tx.id}:`, err);
        }
      } else if (isSha7nawy) {
        const refMatch = tx.note?.match(/sha7nawy_ref:([^\s|]+)/);
        const ref = refMatch ? refMatch[1] : (tx.providerRef || "");
        if (!ref) continue;

        try {
          const gatewayInfo = await getSha7nawyPaymentInfo(ref);
          const rawStatus = (gatewayInfo.data?.status || "unknown").toString().toLowerCase();
          const isPaid = SHA7NAWY_PAID_STATUSES.includes(rawStatus);

          if (isPaid) {
            const targetType = tx.type;
            const isLate = targetType === "credit_sha7nawy_expired";

            let fulfillmentRes: any = null;
            const success = await prisma.$transaction(
              async (db) => {
                const claim = await db.balanceTransaction.updateMany({
                  where: { id: tx.id, type: targetType },
                  data: {
                    type: SHA7NAWY_CREDITED_TYPE,
                    note: `${tx.note} — سداد عبر Sha7nawy (تحديث شامل Brutal Refresh)${isLate ? " (دفع متأخر)" : ""}`,
                  },
                });

                if (claim.count === 0) return false;

                await db.user.update({
                  where: { id: tx.userId },
                  data: { balance: { increment: tx.amount } },
                });

                fulfillmentRes = await fulfillPendingItemPurchase({
                  userId: tx.userId,
                  note: tx.note,
                  tx: db,
                });

                return true;
              },
              { timeout: 20000, maxWait: 10000 }
            );

            if (success) {
              reconciled.push({
                id: tx.id,
                studentName: tx.user?.name || "طالب",
                studentPhone: tx.user?.phone || null,
                amount: tx.amount,
                provider: "Sha7nawy (محفظة إلكترونية)",
                reference: ref,
                itemName: fulfillmentRes?.itemName || "اشتراك/كورس",
              });
            }
          }
        } catch (err) {
          console.warn(`[SyncPayments] Error checking Sha7nawy tx ${tx.id}:`, err);
        }
      }
    }

    if (reconciled.length > 0) {
      await prisma.activityLog.create({
        data: {
          adminId: session.id,
          adminName: session.name || "مشرف عام",
          action: "BRUTAL_REFRESH_PAYMENTS_SYNCED",
          targetType: "PAYMENT_GATEWAY",
          targetId: "GATEWAY_SYNC",
          targetName: `${reconciled.length} اشتراكات`,
          metadata: JSON.stringify({
            count: reconciled.length,
            totalAmount: reconciled.reduce((sum, r) => sum + r.amount, 0),
            students: reconciled.map((r) => `${r.studentName} (${r.amount} ج)`),
          }),
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        totalChecked: candidateTxs.length,
        totalReconciled: reconciled.length,
        reconciled,
        message:
          reconciled.length > 0
            ? `تم فحص ${candidateTxs.length} معاملة وتأكيد ${reconciled.length} اشتراك جديد بنجاح! 🎉`
            : `تم فحص ${candidateTxs.length} معاملة. جميع الاشتراكات والمدفوعات محدثة بالكامل ومطابقة للبوابات.`,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("[SyncPayments] Fatal error:", error);
    return NextResponse.json({ error: "فشل فحص ومزامنة بوابات الدفع" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
