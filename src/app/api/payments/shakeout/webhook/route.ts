import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getShakeOutPaymentInfo,
  SHAKEOUT_PENDING_TYPE,
  SHAKEOUT_CREDITED_TYPE,
  SHAKEOUT_PAID_STATUSES,
  shakeOutRefNote,
} from "@/lib/shakeout";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SHAKEOUT_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-shakeout-secret") ||
        req.nextUrl.searchParams.get("secret");
      if (!incomingSecret || incomingSecret !== webhookSecret) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
        console.warn(`[Shake-Out Webhook] Unauthorized secret attempt from IP: ${ip}`);
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

    // Guard 1: Status re-check
    const verifiedStatus = String(verifiedData.status || "").toLowerCase();
    if (!SHAKEOUT_PAID_STATUSES.includes(verifiedStatus)) {
      console.warn(`[Shake-Out Webhook] Verified status is ${verifiedData.status} for ref ${reference}`);
      return NextResponse.json({ error: "Verification status mismatch" }, { status: 400 });
    }

    // Guard 2: Exact reference match (no substring contains, no split)
    const exactRefNote = shakeOutRefNote(String(reference));

    const pendingTx = await prisma.balanceTransaction.findFirst({
      where: {
        type: SHAKEOUT_PENDING_TYPE,
        note: exactRefNote,
      },
      select: { id: true, userId: true, amount: true },
    });

    if (!pendingTx) {
      const alreadyCredited = await prisma.balanceTransaction.findFirst({
        where: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: exactRefNote,
        },
        select: { id: true },
      });
      if (alreadyCredited) {
        return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
      }
      console.warn(`[Shake-Out Webhook] No pending transaction found for ref ${reference}`);
      return NextResponse.json({ error: "Unknown transaction reference" }, { status: 400 });
    }

    // Guard 3: Client match
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

    const processed = await prisma.$transaction(async (tx) => {
      const claim = await tx.balanceTransaction.updateMany({
        where: { id: pendingTx.id, type: SHAKEOUT_PENDING_TYPE },
        data: {
          type: SHAKEOUT_CREDITED_TYPE,
          note: `${exactRefNote} — شحن محفظة عبر Shake-Out`,
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
