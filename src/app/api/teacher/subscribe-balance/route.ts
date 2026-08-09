import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyAuthoritativePrice } from "@/lib/price-verifier";
import { ReferralService } from "@/services/referral/ReferralService";

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

    // B27b: Price is strictly computed by verifyAuthoritativePrice
    const priceResult = await verifyAuthoritativePrice({
      amount: 999999, // We want the calculated authoritative expected price
      teacherId,
      planType,
      grade: studentGrade,
      languageTrack,
    });

    if (!priceResult.valid || !priceResult.expectedPrice) {
      return NextResponse.json(
        { error: priceResult.error || "لسه الأستاذ محددش سعر الباقة دي. كلّم الدعم." },
        { status: 400 }
      );
    }

    const numAmount = priceResult.expectedPrice;

    // B14: Yearly plan grants 6 months (full 2-term academic year)
    const monthsMap: Record<string, number> = {
      monthly: 1,
      termly: 3,
      yearly: 6,
    };

    const months = monthsMap[planType] || 1;
    const isLanguages = languageTrack === "languages" || languageTrack === "english";

    const profile = await prisma.teacherProfile.findUnique({
      where: { teacherId },
      select: { displayName: true, slug: true },
    });

    const teacherName = profile?.displayName || profile?.slug;
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

        const trackedLang = isLanguages ? "languages" : "arabic";

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
            languageTrack: trackedLang,
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
            languageTrack: trackedLang,
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

    // B28: Reward referral on real subscription purchase
    void ReferralService.qualifyAndRewardReferral(session.id, `sub:${teacherId}:${planType}`).catch(() => {});

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
