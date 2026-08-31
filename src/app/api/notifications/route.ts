import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/notifications — unread + last 20 for the signed-in user */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  // Auto-reconcile recent pending payments on student re-entry (within 48 hours)
  if (session.role === "student") {
    const pendingTxs = await prisma.balanceTransaction.findMany({
      where: {
        userId: session.id,
        type: { in: ["credit_shakeout_pending", "credit_sha7nawy_pending"] },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      take: 3,
    });

    if (pendingTxs.length > 0) {
      for (const pTx of pendingTxs) {
        try {
          const refMatch = pTx.note?.match(/(?:shakeout_ref|sha7nawy_ref):([^\s|]+)/);
          const ref = refMatch ? refMatch[1] : null;
          if (!ref) continue;

          if (pTx.type.includes("shakeout")) {
            const { getShakeOutPaymentInfo, SHAKEOUT_PAID_STATUSES, SHAKEOUT_CREDITED_TYPE } = await import("@/lib/shakeout");
            const { fulfillPendingItemPurchase } = await import("@/lib/fulfillment");
            const info = await getShakeOutPaymentInfo(ref);
            const normalizedStatus = (info.data?.status || "unknown").toString().toLowerCase();
            if (SHAKEOUT_PAID_STATUSES.includes(normalizedStatus)) {
              await prisma.$transaction(async (tx: any) => {
                const claim = await tx.balanceTransaction.updateMany({
                  where: { id: pTx.id, type: pTx.type },
                  data: { type: SHAKEOUT_CREDITED_TYPE, note: `${pTx.note} — سداد وتأكيد فوري عبر Shake-Out` },
                });
                if (claim.count > 0) {
                  await tx.user.update({ where: { id: session.id }, data: { balance: { increment: pTx.amount } } });
                  await fulfillPendingItemPurchase({ userId: session.id, note: pTx.note, tx });
                }
              });
            }
          } else if (pTx.type.includes("sha7nawy")) {
            const { getSha7nawyPaymentInfo, SHA7NAWY_PAID_STATUSES, SHA7NAWY_CREDITED_TYPE } = await import("@/lib/sha7nawy");
            const { fulfillPendingItemPurchase } = await import("@/lib/fulfillment");
            const info = await getSha7nawyPaymentInfo(ref);
            const normalizedStatus = (info.data?.status || "unknown").toString().toLowerCase();
            if (SHA7NAWY_PAID_STATUSES.includes(normalizedStatus)) {
              await prisma.$transaction(async (tx: any) => {
                const claim = await tx.balanceTransaction.updateMany({
                  where: { id: pTx.id, type: pTx.type },
                  data: { type: SHA7NAWY_CREDITED_TYPE, note: `${pTx.note} — سداد وتأكيد فوري عبر Sha7nawy` },
                });
                if (claim.count > 0) {
                  await tx.user.update({ where: { id: session.id }, data: { balance: { increment: pTx.amount } } });
                  await fulfillPendingItemPurchase({ userId: session.id, note: pTx.note, tx });
                }
              });
            }
          }
        } catch {}
      }
    }
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
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
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/notifications — delete single notification by id or all notifications */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get("id");
    const clearAll = url.searchParams.get("all") === "true";

    let bodyId: string | null = null;
    let bodyClearAll = false;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.id) bodyId = body.id;
      if (body?.clearAll) bodyClearAll = true;
    } catch {}

    const targetId = idFromQuery || bodyId;
    const shouldClearAll = clearAll || bodyClearAll;

    if (shouldClearAll) {
      await prisma.notification.deleteMany({
        where: { userId: session.id },
      });
      return NextResponse.json({ success: true, message: "تم حذف جميع الإشعارات" });
    }

    if (!targetId) {
      return NextResponse.json({ error: "معرّف الإشعار مطلوب" }, { status: 400 });
    }

    const deleted = await prisma.notification.deleteMany({
      where: {
        id: targetId,
        userId: session.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "لم يتم العثور على الإشعار" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "تم حذف الإشعار بنجاح" });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حذف الإشعار" }, { status: 500 });
  }
}
