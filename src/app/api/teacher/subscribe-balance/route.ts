import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً لشراء الاشتراك بالرصيد" }, { status: 401 });
    }

    const { teacherId, planType, languageTrack, studentGrade } = await req.json().catch(() => ({}));

    if (!teacherId || typeof teacherId !== "string") {
      return NextResponse.json({ error: "معرف الأستاذ مطلوب" }, { status: 400 });
    }

    // B17: Prevent self-subscription and validate teacher user record
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

    const validPlanTypes = ["monthly", "termly", "yearly"];
    if (!planType || !validPlanTypes.includes(planType)) {
      return NextResponse.json({ error: "نوع الباقة غير صحيح" }, { status: 400 });
    }

    const profile = await prisma.teacherProfile.findUnique({
      where: { teacherId },
      select: {
        priceMonthly: true,
        priceTermly: true,
        priceYearly: true,
        priceLanguagesMonthly: true,
        stagePricing: true,
        displayName: true,
        slug: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "لم يتم العثور على الأستاذ" }, { status: 400 });
    }

    const rawPriceMap: Record<string, number | null> = {
      monthly: profile.priceMonthly,
      termly: profile.priceTermly,
      yearly: profile.priceYearly,
    };

    let planPrice = rawPriceMap[planType];
    if (profile.stagePricing && studentGrade) {
      try {
        const parsedMap = JSON.parse(profile.stagePricing);
        if (parsedMap && parsedMap[studentGrade]) {
          const keyMap: Record<string, string> = {
            monthly: "priceMonthly",
            termly: "priceTermly",
            yearly: "priceYearly",
          };
          const stageVal = parsedMap[studentGrade][keyMap[planType]];
          if (typeof stageVal === "number" && stageVal > 0) {
            planPrice = stageVal;
          }
        }
      } catch {}
    }

    if (planPrice === null || planPrice === undefined || planPrice <= 0) {
      return NextResponse.json(
        { error: "لسه الأستاذ محددش سعر الباقة دي. كلّم الدعم." },
        { status: 400 }
      );
    }

    // B14: Yearly plan grants 6 months (full 2-term academic year)
    const monthsMap: Record<string, number> = {
      monthly: 1,
      termly: 3,
      yearly: 6,
    };

    const months = monthsMap[planType] || 1;
    const isLanguages = languageTrack === "languages" || languageTrack === "english";

    // B9: Do not hide misconfiguration with a silent default — require explicit teacher setting
    if (isLanguages && (profile.priceLanguagesMonthly === null || profile.priceLanguagesMonthly === undefined || profile.priceLanguagesMonthly < 0)) {
      return NextResponse.json(
        { error: "لسه الأستاذ محددش سعر مسار اللغات (Language Track). كلّم الدعم." },
        { status: 400 }
      );
    }

    const langRate = isLanguages ? (profile.priceLanguagesMonthly ?? 0) : 0;
    const languageSurcharge = langRate * months;
    const numAmount = planPrice + languageSurcharge;

    const teacherName = profile.displayName || profile.slug;
    const planNames: Record<string, string> = {
      monthly: "شهر واحد (1 Month)",
      termly: "3 شهور (3 Months)",
      yearly: "6 شهور (6 Months)",
    };
    const planLabel = `${planNames[planType] || "اشتراك"} ${isLanguages ? "(لغات / إنجليزي)" : "(عربي)"}`;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, balance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.balance < numAmount) {
      return NextResponse.json(
        {
          error: `رصيدك الحالي (${user.balance} جنيه) لا يكفي لشراء الاشتراك (${numAmount} جنيه). يرجى شحن رصيدك أولاً.`,
        },
        { status: 400 }
      );
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, phone: true, parentPhone: true, educationalStage: true },
    });

    // B8: Extension logic — extend from existing.expiresAt if active and unexpired
    const existingSub = await prisma.teacherSubscription.findUnique({
      where: {
        studentId_teacherId_planType: {
          studentId: session.id,
          teacherId: teacherId,
          planType: planType,
        },
      },
      select: { expiresAt: true, status: true },
    });

    const now = new Date();
    const baseDate =
      existingSub && existingSub.status === "active" && existingSub.expiresAt && existingSub.expiresAt > now
        ? existingSub.expiresAt
        : now;

    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + months);

    let updatedBalance = 0;

    try {
      updatedBalance = await prisma.$transaction(async (tx) => {
        const claim = await tx.user.updateMany({
          where: { id: session.id, balance: { gte: numAmount } },
          data: { balance: { decrement: numAmount } },
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
            amount: -numAmount,
            note: `حجز اشتراك (${planLabel}) - أستاذ ${teacherName || "المعلم"}`,
          },
        });

        await tx.teacherSubscription.upsert({
          where: {
            studentId_teacherId_planType: {
              studentId: session.id,
              teacherId: teacherId,
              planType: planType,
            },
          },
          create: {
            studentId: session.id,
            teacherId: teacherId,
            planType: planType,
            planLabel: planLabel,
            amount: numAmount,
            educationalStage: userDetails?.educationalStage,
            studentName: userDetails?.name,
            studentPhone: userDetails?.phone,
            parentPhone: userDetails?.parentPhone,
            status: "active",
            expiresAt: expiresAt,
          },
          update: {
            planLabel: planLabel,
            amount: numAmount,
            educationalStage: userDetails?.educationalStage,
            studentName: userDetails?.name,
            studentPhone: userDetails?.phone,
            parentPhone: userDetails?.parentPhone,
            status: "active",
            expiresAt: expiresAt,
          },
        });

        return freshUser?.balance ?? 0;
      });
    } catch (err: any) {
      if (err?.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json(
          { error: `رصيدك الحالي لا يكفي لشراء الاشتراك (${numAmount} جنيه). يرجى شحن رصيدك أولاً.` },
          { status: 400 }
        );
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      message: `تم الشراء وحجز الاشتراك بنجاح! خُصم ${numAmount} جنيه من رصيدك. رصيدك الحالي: ${updatedBalance} جنيه.`,
      newBalance: updatedBalance,
    });
  } catch (error: any) {
    console.error("[subscribe-balance] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء خصم الرصيد" }, { status: 500 });
  }
}
