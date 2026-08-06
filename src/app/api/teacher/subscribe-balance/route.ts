import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً لشراء الاشتراك بالرصيد" }, { status: 401 });
    }

    const { teacherId, planType, languageTrack } = await req.json().catch(() => ({}));

    if (!teacherId || typeof teacherId !== "string") {
      return NextResponse.json({ error: "معرف الأستاذ مطلوب" }, { status: 400 });
    }

    const validPlanTypes = ["monthly", "termly", "yearly"];
    if (!planType || !validPlanTypes.includes(planType)) {
      return NextResponse.json({ error: "نوع الباقة غير صحيح" }, { status: 400 });
    }

    const profile = await prisma.teacherProfile.findUnique({
      where: { teacherId },
      select: { priceMonthly: true, priceTermly: true, priceYearly: true, displayName: true, slug: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "لم يتم العثور على الأستاذ" }, { status: 400 });
    }

    // Default prices if not set: 1 month = 200, 3 months = 600, 6 months = 1200
    const basePriceMap: Record<string, number> = {
      monthly: profile.priceMonthly ?? 200,
      termly: profile.priceTermly ?? 600,
      yearly: profile.priceYearly ?? 1200,
    };

    const monthsMap: Record<string, number> = {
      monthly: 1,
      termly: 3,
      yearly: 6,
    };

    const months = monthsMap[planType] || 1;
    const isLanguages = languageTrack === "languages" || languageTrack === "english";
    const languageSurcharge = isLanguages ? 50 * months : 0;
    const numAmount = basePriceMap[planType] + languageSurcharge;

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

    const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: session.id },
        data: { balance: { decrement: numAmount } },
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

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: `تم الشراء وحجز الاشتراك بنجاح! خُصم ${numAmount} جنيه من رصيدك. رصيدك الحالي: ${updatedUser.balance} جنيه.`,
      newBalance: updatedUser.balance,
    });
  } catch (error: any) {
    console.error("[subscribe-balance] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء خصم الرصيد" }, { status: 500 });
  }
}
