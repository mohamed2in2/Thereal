import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getShakeOutPaymentInfo,
  SHAKEOUT_PENDING_TYPE,
  SHAKEOUT_CREDITED_TYPE,
  shakeOutRefNote,
} from "@/lib/shakeout";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));

    const event = payload.event || req.headers.get("x-webhook-event");
    const transaction = payload.transaction || payload.data || {};

    const status = transaction.status || req.headers.get("x-transaction-status") || payload.status;
    const reference = transaction.reference || req.headers.get("x-transaction-reference") || transaction.id;
    const transactionId = transaction.id || transaction.transaction_id || req.headers.get("x-transaction-id");

    if (event !== "transaction.updated" && !status) {
      return NextResponse.json({ success: true, message: "Ignored non-transaction event" }, { status: 200 });
    }

    if (status === "rejected" || status === "failed") {
      console.warn(`[Shake-Out Webhook] Transaction ${reference} was rejected/failed.`);
      return NextResponse.json({ success: true, processed: false, reason: "Transaction rejected" }, { status: 200 });
    }

    const isCompleted = status === "completed" || status === "success" || status === "paid";
    if (!isCompleted) {
      return NextResponse.json({ success: true, processed: false, reason: `Status is ${status}` }, { status: 200 });
    }

    if (!transactionId || !reference) {
      console.warn("[Shake-Out Webhook] Missing transactionId or reference");
      return NextResponse.json({ error: "Missing transaction identifiers" }, { status: 400 });
    }

    let verified;
    try {
      verified = await getShakeOutPaymentInfo(transactionId);
    } catch (verifyError: any) {
      console.error("[Shake-Out Webhook] Verification unavailable:", verifyError?.message || verifyError);
      return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 });
    }

    if (!verified.status || !verified.data) {
      console.warn(`[Shake-Out Webhook] Verification failed for transaction ${transactionId} (ref ${reference})`);
      return NextResponse.json({ error: "Transaction verification failed" }, { status: 400 });
    }

    const verifiedData = verified.data;
    const verifiedReference = verifiedData.reference ? String(verifiedData.reference) : null;

    const searchRef = String(reference || transactionId || "").split("/")[0];

    const pendingTx = await prisma.balanceTransaction.findFirst({
      where: {
        type: SHAKEOUT_PENDING_TYPE,
        note: { contains: searchRef },
      },
      select: { id: true, userId: true, amount: true },
    });

    if (!pendingTx) {
      const alreadyCredited = await prisma.balanceTransaction.findFirst({
        where: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: { contains: searchRef },
        },
        select: { id: true },
      });
      if (alreadyCredited) {
        return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
      }
      console.warn(`[Shake-Out Webhook] No pending transaction found for ref ${reference} (searchRef: ${searchRef})`);
      return NextResponse.json({ error: "Unknown transaction reference" }, { status: 400 });
    }

    const processed = await prisma.$transaction(async (tx) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: pendingTx.id, type: SHAKEOUT_PENDING_TYPE },
        data: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: `${shakeOutRefNote(String(reference))} — شحن محفظة عبر Shake-Out`,
        },
      });

      if (claim.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: pendingTx.userId },
        data: { balance: { increment: pendingTx.amount } },
      });

      return true;
    });

    if (!processed) {
      return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
    }

    console.log(`[Shake-Out Webhook] Credited ${pendingTx.amount} EGP to user ${pendingTx.userId} (ref ${reference})`);
    return NextResponse.json({ success: true, credited: pendingTx.amount, reference }, { status: 200 });
  } catch (error: any) {
    console.error("[Shake-Out Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
