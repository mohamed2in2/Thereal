import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getShakeOutPaymentInfo,
  SHAKEOUT_PENDING_TYPE,
  SHAKEOUT_CREDITED_TYPE,
  SHAKEOUT_PAID_STATUSES,
  shakeOutRefNote,
} from "@/lib/shakeout";
import { fulfillPendingItemPurchase } from "@/lib/fulfillment";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SHAKEOUT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Shake-Out Webhook] SHAKEOUT_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook configuration missing" }, { status: 500 });
    }
    const incomingSecret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-shakeout-secret");
    if (!incomingSecret || incomingSecret !== webhookSecret) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
      console.warn(`[Shake-Out Webhook] Unauthorized secret attempt from IP: ${ip}`);
      return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
    }

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

    const isCompleted = SHAKEOUT_PAID_STATUSES.includes(String(status || "").toLowerCase());
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

    // Guard 1: Status re-check
    const verifiedStatus = String(verifiedData.status || "").toLowerCase();
    if (!SHAKEOUT_PAID_STATUSES.includes(verifiedStatus)) {
      console.warn(`[Shake-Out Webhook] Verified status is ${verifiedData.status} for ref ${reference}`);
      return NextResponse.json({ error: "Verification status mismatch" }, { status: 400 });
    }

    // Guard 2: Reference match with strict boundary check (prevents prefix collisions while supporting legacy formats)
    const refPrefix = shakeOutRefNote(String(reference));

    const candidates = await prisma.balanceTransaction.findMany({
      where: {
        type: SHAKEOUT_PENDING_TYPE,
        note: { startsWith: refPrefix },
      },
      select: { id: true, userId: true, amount: true, note: true },
    });

    let pendingTx = candidates.find(
      (c) => c.note === refPrefix || c.note?.startsWith(`${refPrefix}|`) || c.note?.startsWith(`${refPrefix} `)
    ) ?? null;

    let targetType = SHAKEOUT_PENDING_TYPE;
    let isLatePayment = false;

    // B23b: Also search expired rows if no active pending row found
    if (!pendingTx) {
      const expiredCandidates = await prisma.balanceTransaction.findMany({
        where: {
          type: "credit_shakeout_expired",
          note: { startsWith: refPrefix },
        },
        select: { id: true, userId: true, amount: true, note: true },
      });
      const expiredTx = expiredCandidates.find(
        (c) => c.note === refPrefix || c.note?.startsWith(`${refPrefix}|`) || c.note?.startsWith(`${refPrefix} `)
      ) ?? null;

      if (expiredTx) {
        pendingTx = expiredTx;
        targetType = "credit_shakeout_expired";
        isLatePayment = true;
        console.log(`LATE_PAYMENT_CREDITED: Shake-Out ref ${reference} matched expired row ${expiredTx.id}`);
      }
    }

    if (!pendingTx) {
      const creditedCandidates = await prisma.balanceTransaction.findMany({
        where: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: { startsWith: refPrefix },
        },
        select: { id: true, note: true },
      });
      const alreadyCredited = creditedCandidates.find(
        (c) => c.note === refPrefix || c.note?.startsWith(`${refPrefix}|`) || c.note?.startsWith(`${refPrefix} `) || c.note?.startsWith(`${refPrefix} —`)
      ) ?? null;
      if (alreadyCredited) {
        return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
      }
      console.warn(`[Shake-Out Webhook] No pending or expired transaction found for ref ${reference}`);
      return NextResponse.json({ error: "Unknown transaction reference" }, { status: 400 });
    }

    // Guard 3: Client match (if provided by gateway)
    if (verifiedData.client && verifiedData.client !== pendingTx.userId) {
      console.warn(
        `[Shake-Out Webhook] Client mismatch: server client=${verifiedData.client} pending user=${pendingTx.userId}`
      );
      return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
    }

    // Guard 4: Amount match
    const verifiedAmount = parseFloat(String(verifiedData.amount));
    if (!isFinite(verifiedAmount) || verifiedAmount <= 0) {
      console.warn(`[Shake-Out Webhook] Invalid verified amount: ${verifiedData.amount}`);
      return NextResponse.json({ error: "Invalid verified amount" }, { status: 400 });
    }

    const totalMatch = pendingTx.note?.match(/\|total:([\d.]+)/);
    const expectedChargedAmount = totalMatch ? parseFloat(totalMatch[1]) : pendingTx.amount;

    if (Math.abs(verifiedAmount - expectedChargedAmount) > 0.01) {
      console.warn(
        `[Shake-Out Webhook] Amount mismatch: verified=${verifiedAmount} expectedCharged=${expectedChargedAmount} pendingBase=${pendingTx.amount} ref=${reference}`
      );
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    let fulfillmentRes: any = null;
    const processed = await prisma.$transaction(async (tx: any) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: pendingTx!.id, type: targetType },
        data: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: `${pendingTx!.note} — شحن محفظة عبر Shake-Out${isLatePayment ? " (دفع متأخر)" : ""}`,
        },
      });

      if (claim.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: pendingTx!.userId },
        data: { balance: { increment: pendingTx!.amount } },
      });

      fulfillmentRes = await fulfillPendingItemPurchase({
        userId: pendingTx!.userId,
        note: pendingTx!.note,
        tx,
      });

      return true;
    });

    if (!processed) {
      return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
    }

    console.log(`[Shake-Out Webhook] Credited ${pendingTx.amount} EGP to user ${pendingTx.userId} (ref ${reference})${isLatePayment ? " [LATE_PAYMENT_CREDITED]" : ""}. Fulfillment:`, fulfillmentRes);
    return NextResponse.json({ success: true, credited: pendingTx.amount, reference, fulfillment: fulfillmentRes }, { status: 200 });
  } catch (error: any) {
    console.error("[Shake-Out Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
