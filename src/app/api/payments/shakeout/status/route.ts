import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShakeOutPaymentInfo, SHAKEOUT_PENDING_TYPE, SHAKEOUT_CREDITED_TYPE, SHAKEOUT_PAID_STATUSES, shakeOutRefNote } from "@/lib/shakeout";
import { getPaymentMethod } from "@/lib/payment-methods";

/**
 * GET /api/payments/shakeout/status?transactionId=123
 * Returns current status of a Shake-Out payment transaction.
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
    return NextResponse.json({ error: gatewayInfo.message || "فشل جلب حالة الدفع من Shake-Out" }, { status: gatewayInfo.code || 500 });
  }

  const data = gatewayInfo.data;
  if (!data?.reference) {
    return NextResponse.json({ error: "الرد من بوابة Shake-Out لا يحتوي على مرجع" }, { status: 502 });
  }

  // B21: Use strict boundary matching (startsWith + delimiter check) instead of contains
  const searchId = (transactionId || "").split("/")[0];
  const refPrefix = shakeOutRefNote(searchId);

  const candidates = await prisma.balanceTransaction.findMany({
    where: {
      userId: session.id,
      note: { startsWith: refPrefix },
    },
    select: { id: true, type: true, amount: true, note: true },
  });

  const existingTx = candidates.find(
    (c) => c.note === refPrefix || c.note?.startsWith(`${refPrefix}|`) || c.note?.startsWith(`${refPrefix} `)
  ) ?? null;

  if (!existingTx) {
    return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
  }

  const normalizedStatus = (data.status || "unknown").toString().toLowerCase();
  const isPaid = SHAKEOUT_PAID_STATUSES.includes(normalizedStatus);

  // B21: Credit the stored base amount, NOT the gateway-reported amount
  if (isPaid && existingTx.type === SHAKEOUT_PENDING_TYPE) {
    const processed = await prisma.$transaction(async (tx) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: existingTx.id, type: SHAKEOUT_PENDING_TYPE },
        data: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: `${existingTx.note || ""} — شحن محفظة عبر Shake-Out (تأكيد سريع)`,
        },
      });

      if (claim.count === 0) {
        return false; // already credited by webhook or another status check
      }

      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: existingTx.amount } },
      });

      return true;
    });

    return NextResponse.json({
      success: true,
      paid: true,
      transactionId,
      reference: data.reference,
      status: "paid",
      amount: existingTx.amount,
      message: processed
        ? "تم تأكيد السداد وإضافة الرصيد إلى حسابك بنجاح! 🎉"
        : "تم تأكيد السداد مسبقاً.",
    });
  }

  return NextResponse.json({
    success: true,
    paid: isPaid,
    transactionId,
    reference: data.reference,
    status: normalizedStatus,
    amount: existingTx.amount,
    method: data.method,
    methodLabel: getPaymentMethod(data.method as string)?.label ?? data.method,
  });
}

