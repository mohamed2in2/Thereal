import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  try {
    const plans = await prisma.plan.findMany({
      where: stage ? { educationalStage: stage } : undefined,
      orderBy: [{ educationalStage: "asc" }, { monthIndex: "asc" }],
      include: {
        _count: {
          select: { lessons: true, enrollments: true },
        },
      },
      skip,
      take: limit,
    });

    const total = await prisma.plan.count({
      where: stage ? { educationalStage: stage } : undefined
    });

    return NextResponse.json({ plans, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json({ error: "تعذر جلب الخطط" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { 
      educationalStage, 
      monthIndex, 
      title, 
      description, 
      price, 
      durationDays, 
      chatEnabled, 
      gradingAIEnabled 
    } = body;

    if (!educationalStage || !title || typeof monthIndex !== "number" || typeof price !== "number") {
      return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
    }

    const plan = await prisma.plan.create({
      data: {
        educationalStage,
        monthIndex,
        title,
        description,
        price,
        durationDays: durationDays ?? 30,
        chatEnabled: chatEnabled ?? true,
        gradingAIEnabled: gradingAIEnabled ?? true,
        createdById: session.id,
      },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "CREATE_PLAN",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Created plan: ${title} (${plan.id})` },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("Failed to create plan:", error);
    return NextResponse.json({ error: "تعذر إنشاء الخطة" }, { status: 500 });
  }
}
