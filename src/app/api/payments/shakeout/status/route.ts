import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShakeOutPaymentInfo } from "@/lib/shakeout";
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

  const searchId = (transactionId || "").split("/")[0];
  const existingTx = await prisma.balanceTransaction.findFirst({
    where: {
      userId: session.id,
      note: { contains: searchId },
    },
    select: { id: true, type: true, amount: true, note: true },
  });

  if (!existingTx) {
    return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
  }

  const normalizedStatus = (data.status || "unknown").toString().toLowerCase();
  const isPaid = ["paid", "completed", "success", "approved"].includes(normalizedStatus);
  const amountToCredit = typeof data.amount === "number" ? data.amount : parseFloat(data.amount ?? "0") || existingTx.amount;

  if (isPaid && existingTx.type.toLowerCase().includes("pending")) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: amountToCredit } },
      });

      await tx.balanceTransaction.update({
        where: { id: existingTx.id },
        data: {
          type: "credit_shakeout_wallet",
          amount: amountToCredit,
          note: `${existingTx.note || ""} (تم التأكيد السريع)`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      paid: true,
      transactionId,
      reference: data.reference,
      status: "paid",
      amount: amountToCredit,
      message: "تم تأكيد السداد وإضافة الرصيد إلى حسابك بنجاح! 🎉",
    });
  }

  return NextResponse.json({
    success: true,
    paid: isPaid,
    transactionId,
    reference: data.reference,
    status: normalizedStatus,
    amount: amountToCredit,
    method: data.method,
    methodLabel: getPaymentMethod(data.method as string)?.label ?? data.method,
  });
}
