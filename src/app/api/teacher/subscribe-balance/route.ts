import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً لشراء الاشتراك بالرصيد" }, { status: 401 });
    }

    const { teacherId, planType } = await req.json().catch(() => ({}));

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

    const priceMap: Record<string, number | null> = {
      monthly: profile.priceMonthly,
      termly: profile.priceTermly,
      yearly: profile.priceYearly,
    };
    const numAmount = priceMap[planType];

    if (numAmount == null) {
      return NextResponse.json({ error: "هذه الباقة غير متوفرة" }, { status: 400 });
    }

    const teacherName = profile.displayName || profile.slug;
    const planLabel = planType.charAt(0).toUpperCase() + planType.slice(1);

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
          note: `حجز اشتراك (${planLabel || "خطة حجز"}) - أستاذ ${teacherName || "المعلم"}`,
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
          planLabel: planLabel || "حجز اشتراك",
          amount: numAmount,
          educationalStage: userDetails?.educationalStage,
          studentName: userDetails?.name,
          studentPhone: userDetails?.phone,
          parentPhone: userDetails?.parentPhone,
          status: "active",
        },
        update: {
          planLabel: planLabel || "حجز اشتراك",
          amount: numAmount,
          educationalStage: userDetails?.educationalStage,
          studentName: userDetails?.name,
          studentPhone: userDetails?.phone,
          parentPhone: userDetails?.parentPhone,
          status: "active",
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
