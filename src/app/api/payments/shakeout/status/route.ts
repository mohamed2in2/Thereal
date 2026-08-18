import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getShakeOutPaymentInfo,
  SHAKEOUT_PENDING_TYPE,
  SHAKEOUT_CREDITED_TYPE,
  SHAKEOUT_PAID_STATUSES,
  shakeOutRefNote,
} from "@/lib/shakeout";
import { getPaymentMethod } from "@/lib/payment-methods";
import { fulfillPendingItemPurchase } from "@/lib/fulfillment";

/**
 * GET /api/payments/shakeout/status?transactionId=123
 * Returns current status of a Shake-Out payment transaction and automatically
 * claims and fulfills pending transactions if the gateway reports payment success.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("transactionId");
  if (!transactionId) {
    return NextResponse.json({ error: "معرف المعاملة مطلوب" }, { status: 400 });
  }

  const gatewayInfo = await getShakeOutPaymentInfo(transactionId);
  if (!gatewayInfo.status) {
    return NextResponse.json(
      { error: gatewayInfo.message || "فشل جلب حالة الدفع من Shake-Out" },
      { status: gatewayInfo.code || 500 }
    );
  }

  const data = gatewayInfo.data;
  if (!data?.reference) {
    return NextResponse.json({ error: "الرد من بوابة Shake-Out لا يحتوي على مرجع" }, { status: 502 });
  }

  const normalizedStatus = (data.status || "unknown").toString().toLowerCase();
  const isPaid = SHAKEOUT_PAID_STATUSES.includes(normalizedStatus);

  // Multi-identifier reference matching for Shake-Out
  const rawId = String(transactionId).trim();
  const idOnly = rawId.split("/")[0];
  const refOnly = rawId.split("/")[1] || "";
  const dataRef = String(data.reference).trim();
  const dataRefIdOnly = dataRef.split("/")[0];

  const searchTokens = Array.from(
    new Set([rawId, idOnly, refOnly, dataRef, dataRefIdOnly].filter(Boolean))
  );

  // Find candidate transaction for this user
  let existingTx: { id: string; type: string; amount: number; note: string } | null = null;

  // 1. Direct providerRef match
  existingTx = await prisma.balanceTransaction.findFirst({
    where: {
      userId: session.id,
      providerRef: { in: searchTokens },
    } as any,
    select: { id: true, type: true, amount: true, note: true },
  });

  // 2. Note search by prefix or containment
  if (!existingTx) {
    for (const token of searchTokens) {
      const refPrefix = shakeOutRefNote(token);
      const candidates = await prisma.balanceTransaction.findMany({
        where: {
          userId: session.id,
          note: { contains: refPrefix },
        },
        select: { id: true, type: true, amount: true, note: true },
      });

      if (candidates.length > 0) {
        existingTx = candidates[0];
        break;
      }
    }
  }

  if (!existingTx) {
    return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
  }

  let fulfillmentRes: any = null;
  let didFulfill = false;

  // If gateway reports paid and transaction is still pending or expired, atomically claim & fulfill!
  if (isPaid && (existingTx.type === SHAKEOUT_PENDING_TYPE || existingTx.type === "credit_shakeout_expired")) {
    const targetTx = existingTx;
    didFulfill = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: targetTx.id, type: targetTx.type },
        data: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: `${targetTx.note} — سداد عبر Shake-Out (تأكيد الحالة)`,
        },
      });

      if (claim.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: targetTx.amount } },
      });

      fulfillmentRes = await fulfillPendingItemPurchase({
        userId: session.id,
        note: targetTx.note,
        tx,
      });

      return true;
    });

    if (didFulfill) {
      console.log(`[Shake-Out Status] Auto-reconciled & credited ${targetTx.amount} EGP for user ${session.id} (ref ${data.reference}).`);
    }
  }

  const customMessage = fulfillmentRes?.message || (didFulfill ? "تم التحقق وتأكيد سداد الفاتورة وتفعيل طلبك بنجاح! 🎉" : isPaid ? "تم تأكيد السداد وتفعيل الطلب مسبقاً." : "الفاتورة ما زالت بانتظار السداد.");

  return NextResponse.json({
    success: true,
    paid: isPaid,
    fulfilled: didFulfill || existingTx.type === SHAKEOUT_CREDITED_TYPE,
    transactionId,
    reference: data.reference,
    status: normalizedStatus,
    amount: existingTx.amount,
    method: data.method,
    methodLabel: getPaymentMethod(data.method as string)?.label ?? data.method,
    message: customMessage,
    fulfillment: fulfillmentRes,
  });
}


