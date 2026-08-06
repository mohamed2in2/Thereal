import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction, verifyRoleActionPassword } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, lessonId } = await params;

  try {
    const body = await req.json();
    const { title, gatesNextLesson, requiresQuiz, requiresHomework, hasProject } = body;

    const currentLesson = await prisma.planLesson.findFirst({
      where: { id: lessonId, planId },
    });
    if (!currentLesson) {
      return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (gatesNextLesson !== undefined) data.gatesNextLesson = gatesNextLesson;
    if (requiresQuiz !== undefined) data.requiresQuiz = requiresQuiz;
    if (requiresHomework !== undefined) data.requiresHomework = requiresHomework;
    if (hasProject !== undefined) data.hasProject = hasProject;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
    }

    const updated = await prisma.planLesson.update({
      where: { id: lessonId },
      data,
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "UPDATE_PLAN_LESSON",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Updated lesson '${updated.title}' in plan ${planId}` },
    });

    return NextResponse.json({ lesson: updated });
  } catch (error) {
    console.error("Failed to update plan lesson:", error);
    return NextResponse.json({ error: "تعذر تحديث الدرس" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, lessonId } = await params;

  try {
    const body = await req.json().catch(() => ({}));

    const lesson = await prisma.planLesson.findFirst({
      where: { id: lessonId, planId },
      include: {
        _count: { select: { progress: true } }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
    }

    // Require password if there is existing progress data
    if (lesson._count.progress > 0) {
      if (!body.actionPassword || !verifyRoleActionPassword(session.role, body.actionPassword)) {
        return NextResponse.json({ 
          error: "يتطلب هذا الإجراء إدخال كلمة مرور الحماية، حيث يوجد تقدم مسجل للطلاب في هذا الدرس.",
          code: "PASSWORD_REQUIRED" 
        }, { status: 403 });
      }
    }

    await prisma.planLesson.delete({ where: { id: lessonId } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_PLAN_LESSON",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Deleted lesson '${lesson.title}' from plan ${planId}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete plan lesson:", error);
    return NextResponse.json({ error: "تعذر حذف الدرس" }, { status: 500 });
  }
}
