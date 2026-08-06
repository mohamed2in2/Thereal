import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessPlanLesson } from "@/lib/plan-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: planId } = await params;

  try {
    const enrollment = await prisma.planEnrollment.findUnique({
      where: { planId_studentId: { planId, studentId: session.id } },
      include: { plan: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "لم تسجل في هذه الخطة بعد" }, { status: 403 });
    }

    const now = new Date();
    const isExpired = enrollment.expiresAt < now;

    // Fetch all plan lessons
    const lessons = await prisma.planLesson.findMany({
      where: { planId },
      orderBy: { order: "asc" },
      include: {
        sources: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                durationMinutes: true,
                isFree: true,
                folder: {
                  select: {
                    courseId: true
                  }
                }
              }
            }
          }
        },
        homeworks: {
          select: {
            id: true,
            title: true,
            content: true,
          }
        }
      }
    });

    // Fetch progress
    const progress = await prisma.planLessonProgress.findMany({
      where: { enrollmentId: enrollment.id }
    });

    // Fetch homework submissions to show status
    const homeworkSubmissions = await prisma.planHomeworkSubmission.findMany({
      where: { enrollmentId: enrollment.id }
    });

    // Fetch project submissions to show status
    const projectSubmissions = await prisma.planProjectSubmission.findMany({
      where: { enrollmentId: enrollment.id }
    });

    // Map lessons and calculate access
    const formattedLessons = lessons.map(lesson => {
      // Calculate unlocked state (ignore expiry for history viewing)
      const mockActiveEnrollment = { expiresAt: new Date(Date.now() + 86400000) };
      const unlocked = canAccessPlanLesson(
        mockActiveEnrollment,
        lesson.order,
        lessons,
        progress
      );

      const p = progress.find(pr => pr.planLessonId === lesson.id);
      
      const lessonHomeworkSubmissions = homeworkSubmissions.filter(h => 
        lesson.homeworks.some(lh => lh.id === h.planHomeworkId)
      );

      const lessonProjectSubmissions = projectSubmissions.filter(pr => 
        pr.planLessonId === lesson.id
      );

      return {
        ...lesson,
        unlocked: unlocked && !isExpired,
        progress: p ? {
          watched: p.watched,
          chosenSourceId: p.chosenSourceId,
          quizPassed: p.quizPassed,
          quizScore: p.quizScore,
          homeworkPassed: p.homeworkPassed,
          projectPassed: p.projectPassed,
          projectGrade: p.projectGrade,
        } : null,
        homeworkSubmissions: lessonHomeworkSubmissions.map(h => ({
          id: h.id,
          planHomeworkId: h.planHomeworkId,
          status: h.status,
          fileUrl: h.fileUrl,
          content: h.content,
        })),
        projectSubmissions: lessonProjectSubmissions.map(pr => ({
          id: pr.id,
          status: pr.status,
          grade: pr.grade,
          feedback: pr.feedback,
          fileUrl: pr.fileUrl,
          content: pr.content,
        }))
      };
    });

    return NextResponse.json({
      plan: enrollment.plan,
      isExpired,
      expiresAt: enrollment.expiresAt.toISOString(),
      lessons: formattedLessons
    });
  } catch (error) {
    console.error("Roadmap GET error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب مسار الخطة" }, { status: 500 });
  }
}
