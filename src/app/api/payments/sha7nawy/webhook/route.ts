import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSha7nawyPaymentInfo,
  SHA7NAWY_PENDING_TYPE,
  SHA7NAWY_CREDITED_TYPE,
  sha7nawyRefNote,
} from "@/lib/sha7nawy";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SHA7NAWY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-sha7nawy-secret") ||
        req.nextUrl.searchParams.get("secret");
      if (!incomingSecret || incomingSecret !== webhookSecret) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
        console.warn(`[Sha7nawy Webhook] Unauthorized secret attempt from IP: ${ip}`);
        return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
      }
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

    if (status === "rejected") {
      console.warn(`[Sha7nawy Webhook] Transaction ${reference} was rejected/failed.`);
      return NextResponse.json({ success: true, processed: false, reason: "Transaction rejected" }, { status: 200 });
    }

    const isCompleted = status === "completed" || status === "success" || status === "paid";
    if (!isCompleted) {
      return NextResponse.json({ success: true, processed: false, reason: `Status is ${status}` }, { status: 200 });
    }

    // Server-side verification is mandatory: never trust amount/user from the payload.
    if (!transactionId || !reference) {
      console.warn("[Sha7nawy Webhook] Missing transactionId or reference");
      return NextResponse.json({ error: "Missing transaction identifiers" }, { status: 400 });
    }

    let verified;
    try {
      verified = await getSha7nawyPaymentInfo(transactionId);
    } catch (verifyError: any) {
      console.error("[Sha7nawy Webhook] Verification unavailable:", verifyError?.message || verifyError);
      return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 });
    }

    if (!verified.status || !verified.data) {
      console.warn(`[Sha7nawy Webhook] Verification failed for transaction ${transactionId} (ref ${reference})`);
      return NextResponse.json({ error: "Transaction verification failed" }, { status: 400 });
    }

    const verifiedData = verified.data;
    if (verifiedData.status !== "completed") {
      console.warn(`[Sha7nawy Webhook] Server status is ${verifiedData.status} for ref ${reference}`);
      return NextResponse.json({ error: "Verification status mismatch" }, { status: 400 });
    }

    const verifiedReference = verifiedData.reference ? String(verifiedData.reference) : null;
    if (verifiedReference && verifiedReference !== String(reference)) {
      console.warn(`[Sha7nawy Webhook] Reference mismatch: payload=${reference} server=${verifiedReference}`);
      return NextResponse.json({ error: "Reference mismatch" }, { status: 400 });
    }

    // The pending entry recorded at payment-creation time is the source of truth.
    const pendingTx = await prisma.balanceTransaction.findFirst({
      where: {
        type: SHA7NAWY_PENDING_TYPE,
        note: sha7nawyRefNote(String(reference)),
      },
      select: { id: true, userId: true, amount: true },
    });

    if (!pendingTx) {
      // Idempotency: maybe it was already credited in an earlier webhook delivery.
      const alreadyCredited = await prisma.balanceTransaction.findFirst({
        where: {
          type: SHA7NAWY_CREDITED_TYPE,
          note: sha7nawyRefNote(String(reference)),
        },
        select: { id: true },
      });
      if (alreadyCredited) {
        return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
      }
      console.warn(`[Sha7nawy Webhook] No pending transaction found for ref ${reference}`);
      return NextResponse.json({ error: "Unknown transaction reference" }, { status: 400 });
    }

    if (verifiedData.client && verifiedData.client !== pendingTx.userId) {
      console.warn(
        `[Sha7nawy Webhook] Client mismatch: server client=${verifiedData.client} pending user=${pendingTx.userId}`
      );
      return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
    }

    const verifiedAmount = parseFloat(String(verifiedData.amount));
    if (!isFinite(verifiedAmount) || verifiedAmount <= 0) {
      console.warn(`[Sha7nawy Webhook] Invalid verified amount: ${verifiedData.amount}`);
      return NextResponse.json({ error: "Invalid verified amount" }, { status: 400 });
    }

    const totalMatch = pendingTx.note?.match(/\|total:([\d.]+)/);
    const expectedChargedAmount = totalMatch ? parseFloat(totalMatch[1]) : pendingTx.amount;

    if (Math.abs(verifiedAmount - expectedChargedAmount) > 0.01) {
      console.warn(
        `[Sha7nawy Webhook] Amount mismatch: verified=${verifiedAmount} expectedCharged=${expectedChargedAmount} pendingBase=${pendingTx.amount} ref=${reference}`
      );
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    // Atomically claim the pending entry and credit the balance. updateMany on
    // type=SHA7NAWY_PENDING_TYPE guarantees only one concurrent webhook wins.
    const processed = await prisma.$transaction(async (tx) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: pendingTx.id, type: SHA7NAWY_PENDING_TYPE },
        data: {
          type: SHA7NAWY_CREDITED_TYPE,
          note: `${sha7nawyRefNote(String(reference))} — شحن محفظة عبر Sha7nawy`,
        },
      });

      if (claim.count === 0) {
        return false; // another delivery already processed it
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

    console.log(`[Sha7nawy Webhook] Credited ${pendingTx.amount} EGP to user ${pendingTx.userId} (ref ${reference})`);
    return NextResponse.json({ success: true, credited: pendingTx.amount, reference }, { status: 200 });
  } catch (error: any) {
    console.error("[Sha7nawy Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
