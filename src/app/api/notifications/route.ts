import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Per-user reconciliation debounce.
 * Prevents the payment-reconciliation block from firing on *every* GET
 * (the notification bell polls every ~30 s, so without a debounce each
 * student with 3 pending txs triggers 3 external API calls per poll).
 * We only reconcile once per 5 minutes per user.
 */
const lastReconciled = new Map<string, number>();
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** GET /api/notifications — unread + last 20 for the signed-in user */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

  // Auto-reconcile recent pending payments — debounced per user
  if (session.role === "student") {
    const now = Date.now();
    const lastTs = lastReconciled.get(session.id) ?? 0;

    if (now - lastTs >= RECONCILE_INTERVAL_MS) {
      lastReconciled.set(session.id, now);

      // Run reconciliation in the background (non-blocking) so the
      // notification response is never held up by external payment APIs.
      reconcilePendingPayments(session.id).catch((err) =>
        console.error("[notifications] reconcile error for", session.id, err)
      );
    }
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  );
}

/** POST /api/notifications — mark all as read */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}

/**
 * Separated helper so the reconciliation logic is readable and the GET
 * handler is not blocked by external payment-gateway round-trips.
 */
async function reconcilePendingPayments(userId: string): Promise<void> {
  const pendingTxs = await prisma.balanceTransaction.findMany({
    where: {
      userId,
      type: { in: ["credit_shakeout_pending", "credit_sha7nawy_pending"] },
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
    take: 3,
  });

  if (pendingTxs.length === 0) return;

  for (const pTx of pendingTxs) {
    try {
      const refMatch = pTx.note?.match(/(?:shakeout_ref|sha7nawy_ref):([^\s|]+)/);
      const ref = refMatch ? refMatch[1] : null;
      if (!ref) continue;

      if (pTx.type.includes("shakeout")) {
        const [
          { getShakeOutPaymentInfo, SHAKEOUT_PAID_STATUSES, SHAKEOUT_CREDITED_TYPE },
          { fulfillPendingItemPurchase },
        ] = await Promise.all([
          import("@/lib/shakeout"),
          import("@/lib/fulfillment"),
        ]);

        const info = await getShakeOutPaymentInfo(ref);
        const normalizedStatus = (info.data?.status ?? "unknown").toString().toLowerCase();

        if (SHAKEOUT_PAID_STATUSES.includes(normalizedStatus)) {
          await prisma.$transaction(async (tx) => {
            const claim = await tx.balanceTransaction.updateMany({
              where: { id: pTx.id, type: pTx.type },
              data: {
                type: SHAKEOUT_CREDITED_TYPE,
                note: `${pTx.note} \u2014 \u0633\u062F\u0627\u062F \u0648\u062A\u0623\u0643\u064A\u062F \u0641\u0648\u0631\u064A \u0639\u0628\u0631 Shake-Out`,
              },
            });
            if (claim.count > 0) {
              await tx.user.update({
                where: { id: userId },
                data: { balance: { increment: pTx.amount } },
              });
              await fulfillPendingItemPurchase({ userId, note: pTx.note, tx });
            }
          });
        }
      } else if (pTx.type.includes("sha7nawy")) {
        const [
          { getSha7nawyPaymentInfo, SHA7NAWY_PAID_STATUSES, SHA7NAWY_CREDITED_TYPE },
          { fulfillPendingItemPurchase },
        ] = await Promise.all([
          import("@/lib/sha7nawy"),
          import("@/lib/fulfillment"),
        ]);

        const info = await getSha7nawyPaymentInfo(ref);
        const normalizedStatus = (info.data?.status ?? "unknown").toString().toLowerCase();

        if (SHA7NAWY_PAID_STATUSES.includes(normalizedStatus)) {
          await prisma.$transaction(async (tx) => {
            const claim = await tx.balanceTransaction.updateMany({
              where: { id: pTx.id, type: pTx.type },
              data: {
                type: SHA7NAWY_CREDITED_TYPE,
                note: `${pTx.note} \u2014 \u0633\u062F\u0627\u062F \u0648\u062A\u0623\u0643\u064A\u062F \u0641\u0648\u0631\u064A \u0639\u0628\u0631 Sha7nawy`,
              },
            });
            if (claim.count > 0) {
              await tx.user.update({
                where: { id: userId },
                data: { balance: { increment: pTx.amount } },
              });
              await fulfillPendingItemPurchase({ userId, note: pTx.note, tx });
            }
          });
        }
      }
    } catch (err) {
      console.error("[notifications] reconcile failed for tx", pTx.id, err);
    }
  }
}
