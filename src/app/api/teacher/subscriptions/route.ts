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

    const { studentEmailOrPhone, planType, planLabel, amount, educationalStage } = await req.json();

    if (!studentEmailOrPhone || !planType) {
      return NextResponse.json({ error: "بيانات الطالب ونوع الباقة مطلوبة" }, { status: 400 });
    }

    // Find student by email or phone
    const student = await prisma.user.findFirst({
      where: {
        OR: [
          { email: studentEmailOrPhone.trim() },
          { phone: studentEmailOrPhone.trim() },
        ],
      },
    });

    if (!student) {
      return NextResponse.json({ error: "لم يتم العثور على طالب بهذا البريد أو الهاتف" }, { status: 404 });
    }

    const labelMap: Record<string, string> = {
      monthly: "اشتراك شهري",
      termly: "اشتراك ترم كامل",
      yearly: "اشتراك سنوي",
    };

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
        amount: Number(amount) || 0,
        educationalStage: educationalStage || student.educationalStage,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        status: "active",
      },
      update: {
        planLabel: planLabel || labelMap[planType] || "اشتراك معلم",
        amount: Number(amount) || 0,
        educationalStage: educationalStage || student.educationalStage,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        status: "active",
      },
    });

    return NextResponse.json({ success: true, subscription: sub });
  } catch (error) {
    console.error("[teacher/subscriptions POST] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إضافة الطالب" }, { status: 500 });
  }
}
