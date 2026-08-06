import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmSha7nawyPayment } from "@/lib/sha7nawy";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ref_code } = body as { ref_code?: string };

    if (!ref_code?.trim()) {
      return NextResponse.json({ error: "رمز المرجع (ref_code) مطلوب" }, { status: 400 });
    }

    const result = await confirmSha7nawyPayment(ref_code.trim());

    if (!result.status) {
      return NextResponse.json(
        { error: result.message || "العملية معلقة أو لم يتم التأكيد بعد" },
        { status: 400 }
      );
    }

    const txData = result.data;
    const status = txData?.status;
    const isCompleted = status === "completed" || result.status === true;

    if (isCompleted && txData?.amount) {
      const amount = parseFloat(txData.amount);
      const reference = txData.reference || ref_code;

      if (!isNaN(amount) && amount > 0) {
        // Prevent double credit
        const existingTx = await prisma.balanceTransaction.findFirst({
          where: {
            userId: session.id,
            note: { contains: reference },
          },
        });

        if (!existingTx) {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: session.id },
              data: { balance: { increment: amount } },
            });

            await tx.balanceTransaction.create({
              data: {
                userId: session.id,
                type: "credit_sha7nawy_wallet",
                amount: amount,
                note: `شحن محفظة عبر Sha7nawy (تأكيد مرجع: ${reference})`,
              },
            });
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: txData?.status || "completed",
      message: result.message || "تم التأكيد وشحن الرصيد بنجاح!",
      data: txData,
    });
  } catch (error: any) {
    console.error("[Sha7nawy Confirm API] Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء التأكيد والاستعلام" }, { status: 500 });
  }
}
