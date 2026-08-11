import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSha7nawyPaymentInfo,
  SHA7NAWY_PENDING_TYPE,
  SHA7NAWY_CREDITED_TYPE,
  SHA7NAWY_PAID_STATUSES,
  sha7nawyRefNote,
} from "@/lib/sha7nawy";
import { prisma } from "@/lib/prisma";
import { fulfillPendingItemPurchase } from "@/lib/fulfillment";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ref_code, transaction_id } = body as { ref_code?: string; transaction_id?: string | number };

    const queryId = transaction_id || ref_code;
    if (!queryId || !String(queryId).trim()) {
      return NextResponse.json({ error: "رمز المرجع أو المعاملة مطلوب" }, { status: 400 });
    }

    const result = await getSha7nawyPaymentInfo(String(queryId).trim());

    if (!result.status || !result.data) {
      return NextResponse.json(
        { error: result.message || "العملية معلقة أو لم يتم التأكيد بعد من مزود الخدمة" },
        { status: 400 }
      );
    }

    const verifiedData = result.data;
    const status = String(verifiedData.status || "").toLowerCase();
    const isCompleted = SHA7NAWY_PAID_STATUSES.includes(status);

    if (!isCompleted) {
      return NextResponse.json({
        success: true,
        paid: false,
        status,
        message: "العملية ما زالت قيد المراجعة أو معلقة",
      });
    }

    // Guard: Client match (if provided by gateway)
    if (verifiedData.client && verifiedData.client !== session.id) {
      console.warn(`[Sha7nawy Confirm] Client mismatch: server=${verifiedData.client} session=${session.id}`);
      return NextResponse.json({ error: "المعاملة غير صالحة للمستخدم الحالي" }, { status: 403 });
    }

    const reference = verifiedData.reference || String(queryId).trim();
    const refPrefix = sha7nawyRefNote(reference);

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

    if (!pendingTx) {
      // If no pending row, return status only — NEVER credit
      return NextResponse.json({
        success: true,
        paid: true,
        status,
        message: "تم التحقق من حالة الفاتورة (لا توجد عملية شحن معلقة للتأكيد).",
      });
    }

    // Atomic claim: only one confirm or webhook delivery wins
    let fulfillmentRes: any = null;
    const processed = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: pendingTx.id, type: SHA7NAWY_PENDING_TYPE },
        data: {
          type: SHA7NAWY_CREDITED_TYPE,
          note: `${pendingTx.note} — شحن محفظة عبر Sha7nawy (تأكيد)`,
        },
      });

      if (claim.count === 0) {
        return false; // already credited
      }

      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: pendingTx.amount } },
      });

      fulfillmentRes = await fulfillPendingItemPurchase({
        userId: session.id,
        note: pendingTx.note,
        tx,
      });

      return true;
    });

    if (processed) {
      console.log(`[Sha7nawy Confirm] Credited ${pendingTx.amount} EGP to user ${session.id} (ref ${reference}). Fulfillment:`, fulfillmentRes);
    }

    const customMessage = fulfillmentRes?.message || (processed ? "تم التأكيد وتفعيل طلبك بنجاح! 🎉" : "تم التأكيد مسبقاً.");

    return NextResponse.json({
      success: true,
      paid: true,
      status: "completed",
      message: customMessage,
      fulfillment: fulfillmentRes,
      data: verifiedData,
    });
  } catch (error: any) {
    console.error("[Sha7nawy Confirm API] Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء التأكيد والاستعلام" }, { status: 500 });
  }
}

