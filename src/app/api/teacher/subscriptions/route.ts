import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const plan = searchParams.get("plan");
    const query = searchParams.get("q");

    const teacherId = session.id;

    const where: any = { teacherId };

    if (stage) where.educationalStage = stage;
    if (plan) where.planType = plan;
    if (query) {
      where.OR = [
        { studentName: { contains: query, mode: "insensitive" } },
        { studentPhone: { contains: query, mode: "insensitive" } },
        { parentPhone: { contains: query, mode: "insensitive" } },
        { student: { name: { contains: query, mode: "insensitive" } } },
        { student: { email: { contains: query, mode: "insensitive" } } },
      ];
    }

    const subscriptions = await prisma.teacherSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            parentPhone: true,
            educationalStage: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("[teacher/subscriptions GET] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب المشتركين" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Refuse when session teacher is a demo account (unless superadmin)
    const teacherUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isDemo: true, role: true },
    });
    if (teacherUser?.isDemo && session.role !== "superadmin") {
      return NextResponse.json({ error: "حساب تجريبي — لا يمكن تسجيل مشتركين يدويين" }, { status: 403 });
    }

    const { studentEmailOrPhone, planType, planLabel, educationalStage } = await req.json().catch(() => ({}));

    if (!studentEmailOrPhone || !planType) {
      return NextResponse.json({ error: "بيانات الطالب ونوع الباقة مطلوبة" }, { status: 400 });
    }

    const validPlanTypes = ["monthly", "termly", "yearly"];
    if (!validPlanTypes.includes(planType)) {
      return NextResponse.json({ error: "نوع الباقة غير صحيح" }, { status: 400 });
    }

    // Find student by email or phone
    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { email: String(studentEmailOrPhone).trim().toLowerCase() },
          { phone: String(studentEmailOrPhone).trim() },
        ],
      },
    });

    if (!student) {
      return NextResponse.json({ error: "لم يتم العثور على طالب بهذا البريد أو الهاتف" }, { status: 404 });
    }

    const profile = await prisma.teacherProfile.findUnique({
      where: { teacherId: session.id },
      select: { priceMonthly: true, priceTermly: true, priceYearly: true, stagePricing: true },
    });

    const monthsMap: Record<string, number> = {
      monthly: 1,
      termly: 3,
      yearly: 6,
    };
    const months = monthsMap[planType] || 1;

    let subPrice = 0;
    if (planType === "monthly") subPrice = profile?.priceMonthly ?? 0;
    else if (planType === "termly") subPrice = profile?.priceTermly ?? 0;
    else if (planType === "yearly") subPrice = profile?.priceYearly ?? 0;

    // Stage pricing override if applicable
    const targetStage = educationalStage || student.educationalStage;
    if (profile?.stagePricing && targetStage) {
      try {
        const parsed = JSON.parse(profile.stagePricing);
        if (parsed && parsed[targetStage]) {
          const keyMap: Record<string, string> = {
            monthly: "priceMonthly",
            termly: "priceTermly",
            yearly: "priceYearly",
          };
          const stageVal = parsed[targetStage][keyMap[planType]];
          if (typeof stageVal === "number" && stageVal > 0) {
            subPrice = stageVal;
          }
        }
      } catch {}
    }

    const labelMap: Record<string, string> = {
      monthly: "اشتراك شهري (1 Month)",
      termly: "اشتراك ترم كامل (3 Months)",
      yearly: "اشتراك سنوي (6 Months)",
    };

    // Calculate expiry extending from current active expiresAt
    const existingSub = await prisma.teacherSubscription.findUnique({
      where: {
        studentId_teacherId_planType: {
          studentId: student.id,
          teacherId: session.id,
          planType,
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

    const sub = await prisma.teacherSubscription.upsert({
      where: {
        studentId_teacherId_planType: {
          studentId: student.id,
          teacherId: session.id,
          planType,
        },
      },
      create: {
        studentId: student.id,
        teacherId: session.id,
        planType,
        planLabel: planLabel || labelMap[planType] || "اشتراك معلم",
        amount: subPrice,
        educationalStage: targetStage,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        status: "active",
        expiresAt,
      },
      update: {
        planLabel: planLabel || labelMap[planType] || "اشتراك معلم",
        amount: subPrice,
        educationalStage: targetStage,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        status: "active",
        expiresAt,
      },
    });

    // Write audit log entry
    const { logAdminAction } = await import("@/lib/admin-auth");
    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "MANUAL_TEACHER_SUBSCRIPTION",
      targetType: "STUDENT",
      targetId: student.id,
      targetName: `طالب: ${student.name} - باقة: ${planType} (${subPrice} EGP)`,
    }).catch(() => {});

    return NextResponse.json({ success: true, subscription: sub });
  } catch (error) {
    console.error("[teacher/subscriptions POST] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إضافة الطالب" }, { status: 500 });
  }
}
