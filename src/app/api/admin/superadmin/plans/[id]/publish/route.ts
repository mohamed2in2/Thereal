import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const plan = await prisma.plan.findUnique({ 
      where: { id },
      include: {
        lessons: {
          include: {
            sources: true,
            quizzes: true,
          }
        }
      }
    });

    if (!plan) {
      return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
    }

    if (plan.status === "published") {
      return NextResponse.json({ error: "الخطة منشورة بالفعل" }, { status: 400 });
    }

    if (plan.lessons.length === 0) {
      return NextResponse.json({ error: "لا يمكن نشر خطة فارغة بدون دروس" }, { status: 400 });
    }

    const validationErrors: string[] = [];
    for (const lesson of plan.lessons) {
      if (lesson.sources.length === 0) {
        validationErrors.push(`الدرس "${lesson.title}" لا يحتوي على مصادر فيديو.`);
        continue;
      }

      let defaultSources = lesson.sources.filter(s => s.isDefault);

      // Auto-heal if 0 default sources exist
      if (defaultSources.length === 0) {
        const firstSource = lesson.sources[0];
        await prisma.planLessonSource.update({
          where: { id: firstSource.id },
          data: { isDefault: true }
        });
        firstSource.isDefault = true;
        defaultSources = [firstSource];
      }

      // Auto-heal if multiple default sources exist
      if (defaultSources.length > 1) {
        const keepId = defaultSources[0].id;
        await prisma.planLessonSource.updateMany({
          where: { planLessonId: lesson.id, NOT: { id: keepId } },
          data: { isDefault: false }
        });
        lesson.sources.forEach(s => {
          if (s.id !== keepId) s.isDefault = false;
        });
        defaultSources = [defaultSources[0]];
      }

      if (lesson.requiresQuiz && lesson.quizzes.length === 0) {
        validationErrors.push(`الدرس "${lesson.title}" يتطلب اختباراً ولكن لم يتم ربط أي اختبار به.`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: "فشل التحقق من جاهزية الخطة للنشر", 
        details: validationErrors 
      }, { status: 400 });
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: { status: "published", updatedById: session.id },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "PUBLISH_PLAN",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Published plan: ${plan.title} (${plan.id})` },
    });

    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("Failed to publish plan:", error);
    return NextResponse.json({ error: "تعذر نشر الخطة" }, { status: 500 });
  }
}
