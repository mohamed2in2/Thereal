import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSha7nawyPaymentInfo,
  SHA7NAWY_PENDING_TYPE,
  SHA7NAWY_CREDITED_TYPE,
  SHA7NAWY_PAID_STATUSES,
  sha7nawyRefNote,
} from "@/lib/sha7nawy";
import { getPaymentMethod } from "@/lib/payment-methods";
import { fulfillPendingItemPurchase } from "@/lib/fulfillment";
import { checkVerifiedPaymentAmount } from "@/lib/payment-amount";

/**
 * GET /api/payments/sha7nawy/status?transactionId=123
 * Returns the current status of a Sha7nawy payment and automatically reconciles
 * pending transactions if the gateway confirms payment completion.
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

  // Query the gateway for the latest info (requires secret key)
  const gatewayInfo = await getSha7nawyPaymentInfo(transactionId);
  if (!gatewayInfo.status) {
    return NextResponse.json(
      { error: gatewayInfo.message || "فشل جلب حالة الدفع من Sha7nawy" },
      { status: gatewayInfo.code || 500 }
    );
  }

  const data = gatewayInfo.data;
  if (!data?.reference) {
    return NextResponse.json({ error: "الرد من البوابة لا يحتوي على مرجع" }, { status: 502 });
  }

  const rawRef = String(data.reference).trim();
  const rawId = String(transactionId).trim();
  const searchTokens = Array.from(new Set([rawRef, rawId].filter(Boolean)));

  // Verify user ownership via providerRef or note
  let existingTx = await prisma.balanceTransaction.findFirst({
    where: {
      userId: session.id,
      providerRef: { in: searchTokens },
    } as any,
    select: { id: true, type: true, amount: true, note: true },
  });

  if (!existingTx) {
    for (const token of searchTokens) {
      const refPrefix = sha7nawyRefNote(token);
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

  const normalizedStatus = (data.status || "unknown").toString().toLowerCase();
  const isPaid = SHA7NAWY_PAID_STATUSES.includes(normalizedStatus);

  if (data.client && data.client !== session.id) {
    return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
  }

  if (isPaid) {
    const amountCheck = checkVerifiedPaymentAmount({
      providerAmount: data.amount,
      pendingBaseAmount: existingTx.amount,
      note: existingTx.note,
    });
    if (!amountCheck.valid) {
      console.warn(
        `[Sha7nawy Status] Amount mismatch: verified=${amountCheck.verifiedAmount} expected=${amountCheck.expectedAmount} tx=${existingTx.id}`
      );
      return NextResponse.json({ error: "قيمة المعاملة لا تطابق المبلغ المطلوب" }, { status: 400 });
    }
  }

  let fulfillmentRes: any = null;
  let didFulfill = false;

  // Auto-reconciliation: If paid and transaction is pending/expired, claim & fulfill
  if (isPaid && (existingTx.type === SHA7NAWY_PENDING_TYPE || existingTx.type === "credit_sha7nawy_expired")) {
    const targetTx = existingTx;
    didFulfill = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: targetTx.id, type: targetTx.type },
        data: {
          type: SHA7NAWY_CREDITED_TYPE,
          note: `${targetTx.note} — شحن محفظة عبر Sha7nawy (تأكيد الحالة)`,
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
      console.log(`[Sha7nawy Status] Auto-reconciled & credited ${targetTx.amount} EGP for user ${session.id} (ref ${data.reference}).`);
    }
  }

  const customMessage = fulfillmentRes?.message || (didFulfill ? "تم التأكيد وتفعيل طلبك بنجاح! 🎉" : isPaid ? "تم التأكيد وتفعيل الطلب مسبقاً." : "العملية ما زالت قيد المراجعة أو معلقة.");

  return NextResponse.json({
    success: true,
    paid: isPaid,
    fulfilled: didFulfill || existingTx.type === SHA7NAWY_CREDITED_TYPE,
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
