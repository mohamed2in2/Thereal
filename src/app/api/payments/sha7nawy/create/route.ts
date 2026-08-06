import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createSha7nawyPayment,
  calculateAmountWithTax,
  SHA7NAWY_PENDING_TYPE,
  sha7nawyRefNote,
} from "@/lib/sha7nawy";
import {
  createShakeOutPayment,
  SHAKEOUT_PENDING_TYPE,
  shakeOutRefNote,
} from "@/lib/shakeout";
import { getPaymentMethod } from "@/lib/payment-methods";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { number, amount, method, courseTitle } = body as {
      number?: string;
      amount?: number;
      method?: string;
      courseId?: string;
      courseTitle?: string;
    };

    if (!method) {
      return NextResponse.json({ error: "طريقة الدفع مطلوبة" }, { status: 400 });
    }

    const methodConfig = getPaymentMethod(method);
    if (!methodConfig) {
      return NextResponse.json({ error: "طريقة الدفع غير مدعومة" }, { status: 400 });
    }

    if (!methodConfig.available) {
      return NextResponse.json(
        { error: methodConfig.unavailableNote ?? "طريقة الدفع غير متاحة حالياً" },
        { status: 400 }
      );
    }

    if (methodConfig.needsPhone && !number?.trim()) {
      return NextResponse.json({ error: "رقم المحفظة مطلوب" }, { status: 400 });
    }

    const minAmt = methodConfig.minAmount;
    const maxAmt = methodConfig.maxAmount;
    if (!amount || amount < minAmt || amount > maxAmt) {
      return NextResponse.json(
        { error: `المبلغ مطلوب (الحد الأدنى ${minAmt} جنيه والحد الأقصى ${maxAmt.toLocaleString()} جنيه)` },
        { status: 400 }
      );
    }

    // Calculate tax / service fee dynamically
    const { baseAmount, taxAmount, totalAmount } = calculateAmountWithTax(amount, methodConfig.id);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://code-up.tech").replace(/\/$/, "");

    const details = courseTitle
      ? `شراء: ${courseTitle} (${baseAmount} جنيه + ${methodConfig.feePercentage}% رسوم) = ${totalAmount} جنيه`
      : `شحن رصيد: ${baseAmount} جنيه (+ ${methodConfig.feePercentage}% رسوم = ${totalAmount} جنيه)`;

    // Route dynamically based on provider: sha7nawy vs shakeout
    if (methodConfig.provider === "shakeout") {
      const webhookUrl = `${appUrl}/api/payments/shakeout/webhook`;
      const result = await createShakeOutPayment({
        number: number || "",
        amount: totalAmount,
        method: methodConfig.id,
        client: session.id,
        customerName: session.name || "Student",
        customerEmail: session.email || undefined,
        details,
        webhook_url: webhookUrl,
      });

      if (!result.status) {
        return NextResponse.json({ error: result.message }, { status: result.code || 400 });
      }

      const reference = result.data?.reference ? String(result.data.reference) : null;
      const soCheckoutUrl = result.data?.payment_page_url || result.data?.url || null;
      if (reference) {
        const noteText = `${shakeOutRefNote(reference)}${soCheckoutUrl ? `|url:${soCheckoutUrl}` : ""}`;
        await prisma.balanceTransaction.create({
          data: {
            userId: session.id,
            type: SHAKEOUT_PENDING_TYPE,
            amount: totalAmount,
            note: noteText,
          },
        });
      }

      const finalCheckoutUrl = soCheckoutUrl || (reference ? `https://dash.shake-out.com/invoice/${reference}` : null);

      return NextResponse.json({
        success: true,
        provider: "shakeout",
        reference: result.data?.reference,
        checkoutUrl: finalCheckoutUrl,
        method: methodConfig.id,
        methodLabel: methodConfig.label,
        baseAmount,
        taxAmount,
        totalAmount,
        instructions: result.message || methodConfig.shortNote,
        data: result.data,
      });
    }

    // Default to Sha7nawy Gateway (gate.sha7nawy.com)
    const webhookUrl = `${appUrl}/api/payments/sha7nawy/webhook`;
    const result = await createSha7nawyPayment({
      number: number || "",
      amount: totalAmount,
      method: methodConfig.id,
      client: session.id,
      details,
      webhook_url: webhookUrl,
    });

    if (!result.status) {
      return NextResponse.json({ error: result.message }, { status: result.code || 400 });
    }

    const reference = result.data?.reference ? String(result.data.reference) : null;
    if (reference) {
      await prisma.balanceTransaction.create({
        data: {
          userId: session.id,
          type: SHA7NAWY_PENDING_TYPE,
          amount: totalAmount,
          note: sha7nawyRefNote(reference),
        },
      });
    }

    return NextResponse.json({
      success: true,
      provider: "sha7nawy",
      reference: result.data?.reference,
      method: methodConfig.id,
      methodLabel: methodConfig.label,
      baseAmount,
      taxAmount,
      totalAmount,
      instructions: result.message || methodConfig.shortNote,
      data: result.data,
    });
  } catch (error: any) {
    console.error("[Create Payment API] Error:", error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء بدء عملية الدفع" }, { status: 500 });
  }
}
