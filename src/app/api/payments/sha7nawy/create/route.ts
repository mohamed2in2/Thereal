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

    // B6: Strict amount validation with explicit defaults
    const minAmt = methodConfig.minAmount ?? 5;
    const maxAmt = methodConfig.maxAmount ?? 50000;
    if (!amount || typeof amount !== "number" || !Number.isFinite(amount) || amount < minAmt || amount > maxAmt) {
      return NextResponse.json(
        { error: `المبلغ غير مسموح به — الحد الأدنى ${minAmt} جنيه والحد الأقصى ${maxAmt.toLocaleString()} جنيه` },
        { status: 400 }
      );
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

    // Calculate tax / service fee dynamically
    const { baseAmount, taxAmount, totalAmount } = calculateAmountWithTax(verifiedBaseAmount, methodConfig.id);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://code-up.tech").replace(/\/$/, "");

    const details = courseTitle || priceCheck.itemName
      ? `شراء: ${courseTitle || priceCheck.itemName} (${baseAmount} جنيه + ${methodConfig.feePercentage}% رسوم) = ${totalAmount} جنيه`
      : `شحن رصيد: ${baseAmount} جنيه (+ ${methodConfig.feePercentage}% رسوم = ${totalAmount} جنيه)`;

    // Route internal payments (Platform Balance / Vouchers)
    if (methodConfig.id === "wallet_balance" || methodConfig.provider === "internal") {
      if (teacherId && planType) {
        const subRes = await fetch(`${appUrl}/api/teacher/subscribe-balance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
          body: JSON.stringify({ teacherId, planType, languageTrack, studentGrade: grade }),
        });
        const subData = await subRes.json().catch(() => ({}));
        if (!subRes.ok || subData.error) {
          return NextResponse.json({ error: subData.error || "تعذر إتمام الاشتراك بالرصيد" }, { status: subRes.status || 400 });
        }
        return NextResponse.json({
          success: true,
          isPaidWithBalance: true,
          provider: "internal",
          method: "wallet_balance",
          message: subData.message || "تم تفعيل الاشتراك بالرصيد بنجاح! 🎉",
        });
      }

      if (courseId) {
        const courseRes = await fetch(`${appUrl}/api/courses/${courseId}/purchase`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
          body: JSON.stringify({}),
        });
        const courseData = await courseRes.json().catch(() => ({}));
        if (!courseRes.ok || courseData.error) {
          return NextResponse.json({ error: courseData.error || "تعذر شراء الكورس بالرصيد" }, { status: courseRes.status || 400 });
        }
        return NextResponse.json({
          success: true,
          isPaidWithBalance: true,
          provider: "internal",
          method: "wallet_balance",
          message: courseData.message || "تم شراء الكورس بالرصيد بنجاح! 🎉",
        });
      }

      if (folderId) {
        const folderRes = await fetch(`${appUrl}/api/folders/${folderId}/purchase`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
          body: JSON.stringify({}),
        });
        const folderData = await folderRes.json().catch(() => ({}));
        if (!folderRes.ok || folderData.error) {
          return NextResponse.json({ error: folderData.error || "تعذر شراء المحاضرة بالرصيد" }, { status: folderRes.status || 400 });
        }
        return NextResponse.json({
          success: true,
          isPaidWithBalance: true,
          provider: "internal",
          method: "wallet_balance",
          message: folderData.message || "تم شراء المحاضرة بالرصيد بنجاح! 🎉",
        });
      }

      if (planId) {
        const planRes = await fetch(`${appUrl}/api/plans/${planId}/purchase`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
          body: JSON.stringify({}),
        });
        const planData = await planRes.json().catch(() => ({}));
        if (!planRes.ok || planData.error) {
          return NextResponse.json({ error: planData.error || "تعذر تفعيل الخطة بالرصيد" }, { status: planRes.status || 400 });
        }
        return NextResponse.json({
          success: true,
          isPaidWithBalance: true,
          provider: "internal",
          method: "wallet_balance",
          message: planData.message || "تم تفعيل الخطة بالرصيد بنجاح! 🎉",
        });
      }

      return NextResponse.json(
        { error: "رصيد الحساب مخصص لشراء الكورسات والاشتراكات مباشرة. لشحن رصيد جديد لحسابك اختر فودافون كاش أو فوري." },
        { status: 400 }
      );
    }

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
      // B10: Treat missing reference as gateway initiation failure
      if (!reference) {
        console.error("[Shake-Out Create] Gateway reported success but returned no reference:", result);
        return NextResponse.json(
          { error: "لم يتم بدء عملية الدفع بنجاح من مزود الخدمة ولم يتم خصم أي أموال. حاول مرة أخرى." },
          { status: 502 }
        );
      }

      const soCheckoutUrl = result.data?.payment_page_url || result.data?.url || null;
      // Option A: Pending transaction stores baseAmount as credited amount and totalAmount in note for verification
      const noteText = `${shakeOutRefNote(reference)}|base:${baseAmount}|total:${totalAmount}${soCheckoutUrl ? `|url:${soCheckoutUrl}` : ""}`;
      await prisma.balanceTransaction.create({
        data: {
          userId: session.id,
          type: SHAKEOUT_PENDING_TYPE,
          amount: baseAmount,
          note: noteText,
        },
      });

      const finalCheckoutUrl = soCheckoutUrl || `https://dash.shake-out.com/invoice/${reference}`;

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
    // B10: Treat missing reference as gateway initiation failure
    if (!reference) {
      console.error("[Sha7nawy Create] Gateway reported success but returned no reference:", result);
      return NextResponse.json(
        { error: "لم يتم بدء عملية الدفع بنجاح من مزود الخدمة ولم يتم خصم أي أموال. حاول مرة أخرى." },
        { status: 502 }
      );
    }

    // Option A: Pending transaction stores baseAmount as credited amount and totalAmount in note for verification
    const noteText = `${sha7nawyRefNote(reference)}|base:${baseAmount}|total:${totalAmount}`;
    await prisma.balanceTransaction.create({
      data: {
        userId: session.id,
        type: SHA7NAWY_PENDING_TYPE,
        amount: baseAmount,
        note: noteText,
      },
    });

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
