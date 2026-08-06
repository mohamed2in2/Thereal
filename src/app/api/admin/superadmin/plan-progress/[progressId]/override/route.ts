import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ progressId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { progressId } = await params;

  try {
    const body = await req.json();
    const { watched, quizPassed, homeworkPassed, projectPassed, projectGrade } = body;

    const progress = await prisma.planLessonProgress.findUnique({
      where: { id: progressId },
      include: {
        enrollment: { select: { planId: true } }
      }
    });

    if (!progress) {
      return NextResponse.json({ error: "التقدم غير موجود" }, { status: 404 });
    }

    const data: any = {};
    if (watched !== undefined) data.watched = watched;
    if (quizPassed !== undefined) data.quizPassed = quizPassed;
    if (homeworkPassed !== undefined) data.homeworkPassed = homeworkPassed;
    if (projectPassed !== undefined) data.projectPassed = projectPassed;
    if (projectGrade !== undefined) data.projectGrade = projectGrade;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
    }

    const updated = await prisma.planLessonProgress.update({
      where: { id: progressId },
      data,
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "OVERRIDE_PLAN_PROGRESS",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Overrode progress ${progressId} in plan ${progress.enrollment.planId}` },
    });

    return NextResponse.json({ progress: updated });
  } catch (error) {
    console.error("Failed to override plan progress:", error);
    return NextResponse.json({ error: "تعذر تعديل التقدم" }, { status: 500 });
  }
}
