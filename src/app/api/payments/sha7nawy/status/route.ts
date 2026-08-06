import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSha7nawyPaymentInfo } from "@/lib/sha7nawy";
import { getPaymentMethod } from "@/lib/payment-methods";

/**
 * GET /api/payments/sha7nawy/status?transactionId=123
 * Returns the current status of a Sha7nawy payment.
 *
 * - Authenticated user only.
 * - The transactionId is the gateway's `transaction_id` (numeric).
 * - We verify that the transaction belongs to the caller by checking a
 *   pending/credited ledger entry whose note contains the same reference.
 * - No state changes are performed – the webhook (or confirm endpoint) is the
 *   only place that credits the user's balance.
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
    return NextResponse.json({ error: gatewayInfo.message || "فشل جلب حالة الدفع" }, { status: gatewayInfo.code || 500 });
  }

  const data = gatewayInfo.data;
  if (!data?.reference) {
    return NextResponse.json({ error: "الرد من البوابة لا يحتوي على مرجع" }, { status: 502 });
  }

  // Verify user ownership via pending/credited ledger note
  const existingTx = await prisma.balanceTransaction.findFirst({
    where: {
      userId: session.id,
      note: { contains: data.reference },
    },
    select: { id: true },
  });

  if (!existingTx) {
    // The user is asking about a transaction that does not belong to them.
    return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
  }

  // Normalise status – gateway may return strings like "pending", "completed", "failed"
  const normalizedStatus = (data.status || "unknown").toString().toLowerCase();

  return NextResponse.json({
    transactionId,
    reference: data.reference,
    status: normalizedStatus,
    amount: parseFloat(data.amount ?? "0"),
    method: data.method,
    // expose a short label for UI convenience
    methodLabel: getPaymentMethod(data.method as string)?.label ?? data.method,
  });
}
