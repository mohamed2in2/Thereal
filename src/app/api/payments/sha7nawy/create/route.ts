import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { acquireAdvisoryLock } from "@/lib/distributed-lock";
import { processTeacherAttribution } from "@/lib/referral";
import { ReferralService } from "@/services/referral/ReferralService";
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

    // Strict amount validation with explicit defaults
    const minAmt = methodConfig.minAmount ?? 1;
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

    const rawVerifiedAmount = priceCheck.expectedPrice > 0 ? priceCheck.expectedPrice : amount;
    const verifiedBaseAmount = methodConfig.id === "fawry" ? Math.max(10, rawVerifiedAmount) : rawVerifiedAmount;

    // Calculate tax / service fee dynamically
    const { baseAmount, taxAmount, totalAmount } = calculateAmountWithTax(verifiedBaseAmount, methodConfig.id);

    const origin = req.nextUrl ? req.nextUrl.origin : "https://code-up.tech";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");

    const details = courseTitle || priceCheck.itemName
      ? `شراء: ${courseTitle || priceCheck.itemName} (${baseAmount} جنيه + ${methodConfig.feePercentage}% رسوم) = ${totalAmount} جنيه`
      : `شحن رصيد: ${baseAmount} جنيه (+ ${methodConfig.feePercentage}% رسوم = ${totalAmount} جنيه)`;

    // Handle InstaPay Direct Option
    if (methodConfig.id === "instapay") {
      const whatsappNumber = (process.env.NEXT_PUBLIC_PAYMENT_ACCESS_PASSWORD || "+201285353604").replace(/\D/g, "");
      const itemName = courseTitle || priceCheck.itemName || "شحن رصيد";
      const waMsg = `مرحباً، أريد إتمام الدفع عبر InstaPay 💳\n` +
        `👤 اسم الطالب: ${session.name || "طالب"}\n` +
        `📚 المحتوى: ${itemName}\n` +
        `💰 المبلغ: ${verifiedBaseAmount} جنيه\n` +
        `أرجو إرسال عنوان InstaPay وتأكيد التفعيل.`;

      return NextResponse.json({
        success: true,
        provider: "internal",
        method: "instapay",
        methodLabel: "إنستاباي (InstaPay)",
        baseAmount: verifiedBaseAmount,
        taxAmount: 0,
        totalAmount: verifiedBaseAmount,
        whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMsg)}`,
        instructions: "حوّل المبلغ عبر تطبيق InstaPay ثم اضغط على زر واتساب لإرسال الإشعار والتفعيل الفوري.",
        reference: `IPN-${Date.now().toString(36).toUpperCase()}`,
      });
    }

    // Route internal payments (Platform Balance / Vouchers)
    if (methodConfig.id === "wallet_balance" || methodConfig.provider === "internal") {
      const studentUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { balance: true },
      });

      const currentBalance = studentUser?.balance ?? 0;
      if (currentBalance < verifiedBaseAmount) {
        return NextResponse.json(
          { error: `رصيد حسابك بالمنصة (${currentBalance} جنيه) لا يكفي لشراء المحتوى بالسعر المطلوب (${verifiedBaseAmount} جنيه). يمكنك شحن رصيدك عبر فودافون كاش أو فوري أو إنستاباي.` },
          { status: 400 }
        );
      }

      // 1. Direct Teacher Subscription via Balance
      if (teacherId && planType) {
        if (teacherId === session.id) {
          return NextResponse.json({ error: "لا يمكنك الاشتراك في حسابك الخاص" }, { status: 400 });
        }

        const teacherUser = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { id: true, role: true, isActive: true, isDeleted: true },
        });
        if (!teacherUser || teacherUser.role !== "teacher" || !teacherUser.isActive || teacherUser.isDeleted) {
          return NextResponse.json({ error: "معلم غير متاح أو غير محدد" }, { status: 400 });
        }

        const monthsMap: Record<string, number> = { monthly: 1, termly: 3, yearly: 6 };
        const months = monthsMap[planType] || 1;
        const isLanguages = languageTrack === "languages" || languageTrack === "english";

        const profile = await prisma.teacherProfile.findUnique({
          where: { teacherId },
          select: { displayName: true, slug: true },
        });
        const teacherName = profile?.displayName || profile?.slug || "المعلم";
        const planNames: Record<string, string> = {
          monthly: "شهر واحد (1 Month)",
          termly: "3 شهور (3 Months)",
          yearly: "6 شهور (6 Months)",
        };
        const planLabel = `${planNames[planType] || "اشتراك"} ${isLanguages ? "(لغات / إنجليزي)" : "(عربي)"}`;

        const userDetails = await prisma.user.findUnique({
          where: { id: session.id },
          select: { name: true, phone: true, parentPhone: true, educationalStage: true },
        });

        const existingSub = await prisma.teacherSubscription.findUnique({
          where: {
            studentId_teacherId_planType: {
              studentId: session.id,
              teacherId,
              planType,
            },
          },
          select: { expiresAt: true, status: true },
        });

        const now = new Date();
        const baseDate = existingSub && existingSub.status === "active" && existingSub.expiresAt && existingSub.expiresAt > now
          ? existingSub.expiresAt
          : now;
        const expiresAt = new Date(baseDate);
        expiresAt.setMonth(expiresAt.getMonth() + months);

        try {
          const updatedBalance = await prisma.$transaction(async (tx) => {
            await acquireAdvisoryLock(`spend:${session.id}`, tx);

            const claim = await tx.user.updateMany({
              where: { id: session.id, balance: { gte: verifiedBaseAmount } },
              data: { balance: { decrement: verifiedBaseAmount } },
            });
            if (claim.count === 0) {
              throw new Error("INSUFFICIENT_BALANCE");
            }

            const freshUser = await tx.user.findUnique({
              where: { id: session.id },
              select: { balance: true },
            });

            await tx.balanceTransaction.create({
              data: {
                userId: session.id,
                type: "debit_purchase",
                amount: -verifiedBaseAmount,
                note: `حجز اشتراك (${planLabel}) - أستاذ ${teacherName}`,
              },
            });

            await tx.teacherSubscription.upsert({
              where: {
                studentId_teacherId_planType: {
                  studentId: session.id,
                  teacherId,
                  planType,
                },
              },
              create: {
                studentId: session.id,
                teacherId,
                planType,
                planLabel,
                amount: verifiedBaseAmount,
                educationalStage: userDetails?.educationalStage,
                studentName: userDetails?.name,
                studentPhone: userDetails?.phone,
                parentPhone: userDetails?.parentPhone,
                status: "active",
                expiresAt,
              },
              update: {
                planLabel,
                amount: verifiedBaseAmount,
                educationalStage: userDetails?.educationalStage,
                studentName: userDetails?.name,
                studentPhone: userDetails?.phone,
                parentPhone: userDetails?.parentPhone,
                status: "active",
                expiresAt,
              },
            });

            return freshUser?.balance ?? 0;
          });

          void ReferralService.qualifyAndRewardReferral(session.id, `sub:${teacherId}:${planType}`).catch(() => {});

          return NextResponse.json({
            success: true,
            isPaidWithBalance: true,
            provider: "internal",
            method: "wallet_balance",
            newBalance: updatedBalance,
            message: `تم حجز وتفعيل الاشتراك مع أستاذ ${teacherName} بنجاح! خُصم ${verifiedBaseAmount} جنيه من رصيدك. 🎉`,
          });
        } catch (err: any) {
          if (err.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ error: "رصيد حسابك غير كافٍ لإتمام العملية" }, { status: 400 });
          }
          throw err;
        }
      }

      // 2. Direct Course Purchase via Balance
      if (courseId) {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          select: { id: true, title: true, teacherId: true },
        });
        if (!course) return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });

        const now = new Date();
        const code = `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

        try {
          const purchaseResult = await prisma.$transaction(async (tx) => {
            await acquireAdvisoryLock(`spend:${session.id}`, tx);

            const existing = await tx.accessCode.findFirst({
              where: { courseId, studentId: session.id },
              select: { id: true },
            });
            if (existing) throw new Error("ALREADY_ENROLLED");

            const claim = await tx.user.updateMany({
              where: { id: session.id, balance: { gte: verifiedBaseAmount } },
              data: { balance: { decrement: verifiedBaseAmount } },
            });
            if (claim.count === 0) throw new Error("INSUFFICIENT_FUNDS");

            const student = await tx.user.findUnique({
              where: { id: session.id },
              select: { balance: true },
            });

            await tx.accessCode.create({
              data: { code, courseId, studentId: session.id, isActive: true, usedAt: now },
            });

            await tx.balanceTransaction.create({
              data: {
                userId: session.id,
                type: "debit_course",
                amount: -verifiedBaseAmount,
                note: `شراء كورس: ${course.title}`,
              },
            });

            await processTeacherAttribution({
              studentId: session.id,
              teacherIdOfContent: course.teacherId,
              amount: verifiedBaseAmount,
              purchaseType: "COURSE",
              courseId: course.id,
              tx,
            });

            return { newBalance: student?.balance ?? 0 };
          });

          return NextResponse.json({
            success: true,
            isPaidWithBalance: true,
            provider: "internal",
            method: "wallet_balance",
            newBalance: purchaseResult.newBalance,
            message: `تم شراء «${course.title}» بنجاح! خُصم ${verifiedBaseAmount} جنيه من رصيدك. 🎉`,
          });
        } catch (err: any) {
          if (err.message === "ALREADY_ENROLLED") {
            return NextResponse.json({ error: "أنت مسجّل بالفعل في هذا الكورس" }, { status: 400 });
          }
          if (err.message === "INSUFFICIENT_FUNDS") {
            return NextResponse.json({ error: "رصيدك غير كافٍ لإتمام الشراء" }, { status: 400 });
          }
          throw err;
        }
      }

      // 3. Direct Folder Purchase via Balance
      if (folderId) {
        const folder = await prisma.folder.findUnique({
          where: { id: folderId },
          include: { course: { select: { id: true, teacherId: true, title: true } } },
        });
        if (!folder) return NextResponse.json({ error: "المحاضرة غير موجودة" }, { status: 404 });
        if (!folder.isPurchasable) {
          return NextResponse.json({ error: "هذا المجلد غير متاح للشراء منفرداً" }, { status: 403 });
        }

        try {
          const purchase = await prisma.$transaction(async (tx) => {
            await acquireAdvisoryLock(`spend:${session.id}`, tx);

            const existing = await tx.folderPurchase.findUnique({
              where: { studentId_folderId: { studentId: session.id, folderId } },
            });
            if (existing) throw new Error("ALREADY_OWNED");

            const claim = await tx.user.updateMany({
              where: { id: session.id, balance: { gte: verifiedBaseAmount } },
              data: { balance: { decrement: verifiedBaseAmount } },
            });
            if (claim.count === 0) throw new Error("INSUFFICIENT_BALANCE");

            await tx.balanceTransaction.create({
              data: {
                userId: session.id,
                type: "debit_course",
                amount: -verifiedBaseAmount,
                note: `شراء مجلد: ${folder.name}`,
              },
            });

            const res = await tx.folderPurchase.create({
              data: { studentId: session.id, folderId, price: verifiedBaseAmount },
            });

            await processTeacherAttribution({
              studentId: session.id,
              teacherIdOfContent: folder.course.teacherId,
              amount: verifiedBaseAmount,
              purchaseType: "FOLDER",
              folderId,
              courseId: folder.course.id,
              tx,
            });

            return res;
          });

          return NextResponse.json({
            success: true,
            isPaidWithBalance: true,
            provider: "internal",
            method: "wallet_balance",
            message: `تم شراء محاضرة «${folder.name}» بالرصيد بنجاح! 🎉`,
          });
        } catch (error: any) {
          if (error.message === "ALREADY_OWNED") {
            return NextResponse.json({ error: "لقد اشتريت هذه المحاضرة بالفعل" }, { status: 400 });
          }
          if (error.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ error: "رصيدك غير كافٍ" }, { status: 400 });
          }
          throw error;
        }
      }

      // 4. Direct Study Plan Purchase via Balance
      if (planId) {
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan || plan.status !== "published") {
          return NextResponse.json({ error: "الخطة غير متاحة" }, { status: 404 });
        }

        try {
          await prisma.$transaction(async (tx) => {
            await acquireAdvisoryLock(`spend:${session.id}`, tx);

            const alreadyEnrolled = await tx.planEnrollment.findUnique({
              where: { planId_studentId: { planId, studentId: session.id } },
            });
            if (alreadyEnrolled) throw new Error("ALREADY_ENROLLED");

            const claim = await tx.user.updateMany({
              where: { id: session.id, balance: { gte: verifiedBaseAmount } },
              data: { balance: { decrement: verifiedBaseAmount } },
            });
            if (claim.count === 0) throw new Error("INSUFFICIENT_FUNDS");

            await tx.balanceTransaction.create({
              data: {
                userId: session.id,
                type: "debit_purchase",
                amount: -verifiedBaseAmount,
                note: `شراء الخطة الدراسية: ${plan.title}`,
              },
            });

            const durationDays = plan.durationDays > 0 ? plan.durationDays : 365;
            await tx.planEnrollment.create({
              data: {
                planId,
                studentId: session.id,
                pricePaid: verifiedBaseAmount,
                expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
              },
            });
          });

          return NextResponse.json({
            success: true,
            isPaidWithBalance: true,
            provider: "internal",
            method: "wallet_balance",
            message: `تم الاشتراك في خطة «${plan.title}» بالرصيد بنجاح! 🎉`,
          });
        } catch (e: any) {
          if (e.message === "ALREADY_ENROLLED") {
            return NextResponse.json({ error: "أنت مسجل بالفعل في هذه الخطة" }, { status: 400 });
          }
          if (e.message === "INSUFFICIENT_FUNDS") {
            return NextResponse.json({ error: "الرصيد غير كافٍ لإتمام العملية" }, { status: 400 });
          }
          throw e;
        }
      }

      return NextResponse.json(
        { error: "رصيد الحساب مخصص لشراء الكورسات والاشتراكات مباشرة. لشحن رصيد جديد لحسابك اختر فودافون كاش أو فوري أو إنستاباي." },
        { status: 400 }
      );
    }

    let itemMeta = "";
    if (teacherId && planType) {
      itemMeta = `|itemType:teacher_sub|teacherId:${teacherId}|planType:${planType}|grade:${grade || ""}|lang:${languageTrack || ""}`;
    } else if (courseId) {
      itemMeta = `|itemType:course|courseId:${courseId}`;
    } else if (folderId) {
      itemMeta = `|itemType:folder|folderId:${folderId}`;
    } else if (planId) {
      itemMeta = `|itemType:plan|planId:${planId}`;
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
      const noteText = `${shakeOutRefNote(reference)}|base:${baseAmount}|total:${totalAmount}${itemMeta}${soCheckoutUrl ? `|url:${soCheckoutUrl}` : ""}`;
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
    const noteText = `${sha7nawyRefNote(reference)}|base:${baseAmount}|total:${totalAmount}${itemMeta}`;
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
