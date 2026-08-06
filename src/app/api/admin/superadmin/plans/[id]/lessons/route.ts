import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const lessons = await prisma.planLesson.findMany({
      where: { planId },
      orderBy: { order: "asc" },
      include: {
        sources: {
          include: {
            video: {
              select: { title: true, vdoCipherId: true, videoProvider: true, providerVideoId: true }
            }
          }
        },
        quizzes: { select: { id: true, title: true } }
      }
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error("Failed to fetch plan lessons:", error);
    return NextResponse.json({ error: "تعذر جلب الدروس" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const body = await req.json();
    const { title, gatesNextLesson, requiresQuiz, requiresHomework, hasProject } = body;

    if (!title) {
      return NextResponse.json({ error: "عنوان الدرس مطلوب" }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });

    const count = await prisma.planLesson.count({ where: { planId } });

    const lesson = await prisma.planLesson.create({
      data: {
        planId,
        title,
        order: count, // Append to the end
        gatesNextLesson: gatesNextLesson ?? true,
        requiresQuiz: requiresQuiz ?? false,
        requiresHomework: requiresHomework ?? false,
        hasProject: hasProject ?? false,
      },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "CREATE_PLAN_LESSON",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Created lesson '${title}' in plan ${planId}` },
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    console.error("Failed to create plan lesson:", error);
    return NextResponse.json({ error: "تعذر إنشاء الدرس" }, { status: 500 });
  }
}
