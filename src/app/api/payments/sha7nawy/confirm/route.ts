import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmSha7nawyPayment, SHA7NAWY_PENDING_TYPE, SHA7NAWY_CREDITED_TYPE, sha7nawyRefNote } from "@/lib/sha7nawy";
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

    if (isCompleted) {
      const reference = txData?.reference || ref_code;

      // B20: Look up the pending transaction by reference using strict boundary
      // matching (same pattern as webhook). Never trust gateway-reported amount.
      const refPrefix = sha7nawyRefNote(String(reference));

      const candidates = await prisma.balanceTransaction.findMany({
        where: {
          type: SHA7NAWY_PENDING_TYPE,
          userId: session.id,
          note: { startsWith: refPrefix },
        },
        select: { id: true, userId: true, amount: true, note: true },
      });

      const pendingTx = candidates.find(
        (c) => c.note === refPrefix || c.note?.startsWith(`${refPrefix}|`) || c.note?.startsWith(`${refPrefix} `)
      ) ?? null;

      if (pendingTx) {
        // Atomic claim: only one confirm/webhook can credit
        const processed = await prisma.$transaction(async (tx) => {
          const claim = await tx.balanceTransaction.updateMany({
            where: { id: pendingTx.id, type: SHA7NAWY_PENDING_TYPE },
            data: {
              type: SHA7NAWY_CREDITED_TYPE,
              note: `${pendingTx.note} — شحن محفظة عبر Sha7nawy (تأكيد)`,
            },
          });

          if (claim.count === 0) {
            return false; // already credited by webhook or another confirm
          }

          // Credit the stored base amount, NOT the gateway-reported amount
          await tx.user.update({
            where: { id: session.id },
            data: { balance: { increment: pendingTx.amount } },
          });

          return true;
        });

        if (processed) {
          console.log(`[Sha7nawy Confirm] Credited ${pendingTx.amount} EGP to user ${session.id} (ref ${reference})`);
        }
      }
      // If no pendingTx found, it was either already credited or doesn't belong to this user — safe to return success
    }

    return NextResponse.json({
      success: true,
      status: txData?.status || "completed",
      message: result.message || "تم التأكيد وشحن الرصيد بنجاح!",
    });
  } catch (error: any) {
    console.error("[Sha7nawy Confirm API] Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء التأكيد والاستعلام" }, { status: 500 });
  }
}
