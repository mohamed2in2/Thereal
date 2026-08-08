import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createShakeOutPayment,
  SHAKEOUT_PENDING_TYPE,
  shakeOutRefNote,
} from "@/lib/shakeout";
import { calculateAmountWithTax } from "@/lib/sha7nawy";
import { getPaymentMethod } from "@/lib/payment-methods";
import { paymentRateLimiter } from "@/lib/paymentRateLimiter";

import { verifyAuthoritativePrice } from "@/lib/price-verifier";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  const rateCheck = await paymentRateLimiter.checkRateLimit(session.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `تم تجاوز الحد الأقصى لبدء عمليات الدفع (10 عمليات/ساعة). يرجى الانتظار لمدة ${Math.ceil(rateCheck.resetInSeconds / 60)} دقيقة.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      number,
      amount,
      method,
      courseId,
      courseTitle,
      teacherId,
      planType,
      grade,
      languageTrack,
      folderId,
      planId,
    } = body as {
      number?: string;
      amount?: number;
      method?: string;
      courseId?: string;
      courseTitle?: string;
      teacherId?: string;
      planType?: string;
      grade?: string;
      languageTrack?: string;
      folderId?: string;
      planId?: string;
    };

    if (!amount || amount < 5) {
      return NextResponse.json({ error: "المبلغ مطلوب (الحد الأدنى 5 جنيه)" }, { status: 400 });
    }

    // ── Server-Side Authoritative Price Verification ──
    const priceCheck = await verifyAuthoritativePrice({
      amount,
      teacherId,
      planType,
      grade,
      languageTrack,
      courseId,
      folderId,
      planId,
    });

    if (!priceCheck.valid) {
      return NextResponse.json(
        { error: priceCheck.error || "المبلغ المطلوب لا يطابق السعر الفعلي المعتمد." },
        { status: 400 }
      );
    }

    const verifiedBaseAmount = priceCheck.expectedPrice > 0 ? priceCheck.expectedPrice : amount;

    const selectedMethod = method || "shakeout_wallet";
    const methodConfig = getPaymentMethod(selectedMethod);
    const { baseAmount, taxAmount, totalAmount } = calculateAmountWithTax(verifiedBaseAmount, selectedMethod);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://code-up.tech").replace(/\/$/, "");
    const webhookUrl = `${appUrl}/api/payments/shakeout/webhook`;

    const details = courseTitle || priceCheck.itemName
      ? `شراء: ${courseTitle || priceCheck.itemName} عبر Shake-Out (${baseAmount} جنيه + ${methodConfig?.feePercentage ?? 2}% رسوم) = ${totalAmount} جنيه`
      : `شحن رصيد: ${baseAmount} جنيه عبر Shake-Out (+ ${methodConfig?.feePercentage ?? 2}% رسوم = ${totalAmount} جنيه)`;

    const result = await createShakeOutPayment({
      number: number || "",
      amount: totalAmount,
      method: selectedMethod,
      client: session.id,
      details,
      webhook_url: webhookUrl,
    });

    if (!result.status) {
      return NextResponse.json({ error: result.message }, { status: result.code || 400 });
    }

    const reference = result.data?.reference ? String(result.data.reference) : null;
    const checkoutUrl = result.data?.payment_page_url || result.data?.url || null;
    if (reference) {
      // B22: Store baseAmount (not totalAmount) matching sha7nawy pattern.
      // Include base/total in note so webhook can verify charged amount.
      const noteText = `${shakeOutRefNote(reference)}|base:${baseAmount}|total:${totalAmount}${checkoutUrl ? `|url:${checkoutUrl}` : ""}`;
      await prisma.balanceTransaction.create({
        data: {
          userId: session.id,
          type: SHAKEOUT_PENDING_TYPE,
          amount: baseAmount,
          note: noteText,
        },
      });
    }

    const finalCheckoutUrl = checkoutUrl || (reference ? `https://dash.shake-out.com/invoice/${reference}` : null);

    return NextResponse.json({
      success: true,
      provider: "shakeout",
      reference: result.data?.reference,
      checkoutUrl: finalCheckoutUrl,
      method: selectedMethod,
      methodLabel: methodConfig?.label || "Shake-Out Payment",
      baseAmount,
      taxAmount,
      totalAmount,
      instructions: result.message || methodConfig?.shortNote || "تم إنشاء الفاتورة بنجاح. جارٍ توجيهك للسداد...",
      data: result.data,
    });
  } catch (error: any) {
    console.error("[Shake-Out Create API] Error:", error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء بدء الدفع عبر Shake-Out" }, { status: 500 });
  }
}
