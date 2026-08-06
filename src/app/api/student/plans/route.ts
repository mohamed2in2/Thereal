import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const enrollments = await prisma.planEnrollment.findMany({
      where: { studentId: session.id },
      include: {
        plan: {
          include: {
            lessons: true,
            _count: { select: { lessons: true } },
          },
        },
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const enrolledPlans = enrollments.map((e) => {
      const completedLessons = e.plan.lessons.filter((lesson) => {
        const prog = e.progress.find((p) => p.planLessonId === lesson.id);
        if (!prog) return false;
        if (!prog.watched) return false;
        if (lesson.requiresQuiz && !prog.quizPassed) return false;
        if (lesson.requiresHomework && !prog.homeworkPassed) return false;
        if (lesson.hasProject && !prog.projectPassed) return false;
        return true;
      }).length;

      return {
        id: e.plan.id,
        title: e.plan.title,
        educationalStage: e.plan.educationalStage,
        totalLessons: e.plan._count.lessons,
        completedLessons,
        progressPercent: e.plan._count.lessons > 0 ? Math.round((completedLessons / e.plan._count.lessons) * 100) : 0,
        expiresAt: e.expiresAt,
      };
    });

    return NextResponse.json({ success: true, enrolledPlans });
  } catch (error) {
    console.error("Student Plans API error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
