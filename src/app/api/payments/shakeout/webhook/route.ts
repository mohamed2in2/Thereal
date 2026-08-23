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
import { secretsMatch } from "@/lib/secret-compare";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SHAKEOUT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Shake-Out Webhook] SHAKEOUT_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook configuration missing" }, { status: 500 });
    }
    const incomingSecret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-shakeout-secret") ||
      req.headers.get("authorization")?.replace(/^bearer\s+/i, "");

    if (!secretsMatch(incomingSecret, webhookSecret)) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
      console.warn(`[Shake-Out Webhook] Unauthorized secret attempt from IP: ${ip}`);
      return NextResponse.json({ error: "Unauthorized webhook caller" }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const rawData = payload.data || payload.transaction || payload.invoice || payload;

    const invoiceId = rawData.invoice_id || rawData.id || rawData.transaction_id || payload.invoice_id || payload.id;
    const invoiceRef = rawData.invoice_ref || rawData.reference || payload.invoice_ref || payload.reference;
    const combinedRef = (invoiceId && invoiceRef) ? `${invoiceId}/${invoiceRef}` : (invoiceId || invoiceRef || "");

    const event = payload.event || req.headers.get("x-webhook-event");
    const status = rawData.status || rawData.invoice_status || rawData.payment_status || req.headers.get("x-transaction-status") || payload.status;
    const reference = combinedRef || rawData.reference || invoiceRef || invoiceId || req.headers.get("x-transaction-reference") || rawData.id;
    const transactionId = combinedRef || invoiceId || rawData.id || rawData.transaction_id || req.headers.get("x-transaction-id");

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

    // Guard 2: Reference match with fast multi-token lookup via providerRef and note tags
    const refStr = String(reference).trim();
    const txIdStr = String(transactionId).trim();
    const verifiedRef = String(verifiedData.reference || "").trim();
    const idOnly = txIdStr.split("/")[0] || refStr.split("/")[0];
    const refOnly = txIdStr.split("/")[1] || refStr.split("/")[1] || "";
    const verifiedIdOnly = verifiedRef.split("/")[0];
    const verifiedRefOnly = verifiedRef.split("/")[1] || "";

    const searchTokens = Array.from(
      new Set([refStr, txIdStr, verifiedRef, idOnly, refOnly, verifiedIdOnly, verifiedRefOnly].filter(Boolean))
    );

    let pendingTx: { id: string; userId: string; amount: number; note: string } | null = null;
    let targetType = SHAKEOUT_PENDING_TYPE;
    let isLatePayment = false;

    // 1. Direct providerRef match on active pending
    pendingTx = await prisma.balanceTransaction.findFirst({
      where: {
        type: SHAKEOUT_PENDING_TYPE,
        providerRef: { in: searchTokens },
      } as any,
      select: { id: true, userId: true, amount: true, note: true },
    });

    // 2. Note search on active pending
    if (!pendingTx) {
      for (const token of searchTokens) {
        const refPrefix = shakeOutRefNote(token);
        const candidates = await prisma.balanceTransaction.findMany({
          where: {
            type: SHAKEOUT_PENDING_TYPE,
            OR: [
              { note: { contains: refPrefix } },
              { note: { contains: `inv_id:${token}` } },
              { note: { contains: `inv_ref:${token}` } },
              ...(token.length >= 6 ? [{ note: { contains: token } }] : []),
            ],
          },
          select: { id: true, userId: true, amount: true, note: true },
        });

        if (candidates.length > 0) {
          pendingTx = candidates[0];
          break;
        }
      }
    }

    // 3. Search expired rows for late payments
    if (!pendingTx) {
      let expiredTx = await prisma.balanceTransaction.findFirst({
        where: {
          type: "credit_shakeout_expired",
          providerRef: { in: searchTokens },
        } as any,
        select: { id: true, userId: true, amount: true, note: true },
      });

      if (!expiredTx) {
        for (const token of searchTokens) {
          const refPrefix = shakeOutRefNote(token);
          const candidates = await prisma.balanceTransaction.findMany({
            where: {
              type: "credit_shakeout_expired",
              OR: [
                { note: { contains: refPrefix } },
                { note: { contains: `inv_id:${token}` } },
                { note: { contains: `inv_ref:${token}` } },
                ...(token.length >= 6 ? [{ note: { contains: token } }] : []),
              ],
            },
            select: { id: true, userId: true, amount: true, note: true },
          });

          if (candidates.length > 0) {
            expiredTx = candidates[0];
            break;
          }
        }
      }

      if (expiredTx) {
        pendingTx = expiredTx;
        targetType = "credit_shakeout_expired";
        isLatePayment = true;
        console.log(`LATE_PAYMENT_CREDITED: Shake-Out ref ${reference} matched expired row ${expiredTx.id}`);
      }
    }

    // 4. Check if already credited
    if (!pendingTx) {
      const alreadyCreditedDirect = await prisma.balanceTransaction.findFirst({
        where: {
          type: SHAKEOUT_CREDITED_TYPE,
          providerRef: { in: searchTokens },
        } as any,
        select: { id: true, note: true },
      });

      if (alreadyCreditedDirect) {
        return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
      }

      for (const token of searchTokens) {
        const refPrefix = shakeOutRefNote(token);
        const creditedCandidates = await prisma.balanceTransaction.findMany({
          where: {
            type: SHAKEOUT_CREDITED_TYPE,
            OR: [
              { note: { contains: refPrefix } },
              { note: { contains: `inv_id:${token}` } },
              { note: { contains: `inv_ref:${token}` } },
              ...(token.length >= 6 ? [{ note: { contains: token } }] : []),
            ],
          },
          select: { id: true, note: true },
        });

        if (creditedCandidates.length > 0) {
          return NextResponse.json({ success: true, processed: false, reason: "Already credited" }, { status: 200 });
        }
      }

      console.warn(`[Shake-Out Webhook] No pending or expired transaction found for ref ${reference} (tokens: ${searchTokens.join(",")})`);
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

    const matchesTotal = Math.abs(verifiedAmount - expectedChargedAmount) <= 0.05;
    const matchesBase = Math.abs(verifiedAmount - pendingTx.amount) <= 0.05;

    if (!matchesTotal && !matchesBase && Math.abs(verifiedAmount - expectedChargedAmount) > 0.01) {
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
