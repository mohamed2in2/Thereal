/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

      try {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

      const { id: quizId } = await params;
      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: { orderBy: { order: "asc" } },
          folder: {
            select: {
              courseId: true,
              course: {
                select: { teacherId: true, title: true, subject: true },
              },
            },
          },
          planLesson: { select: { id: true, planId: true } },
        },
      });

      if (!quiz) return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });

      const canAccessAsTeacher = session.role === "teacher" && (
        quiz.folder?.course?.teacherId === session.id || quiz.planLessonId !== null
      );
      
      let canAccessAsStudent = false;
      if (quiz.folderId && quiz.folder) {
        const hasCourseAccess = await prisma.accessCode.findFirst({
          where: { courseId: quiz.folder.courseId, studentId: session.id, isActive: true },
          select: { id: true },
        });
        if (hasCourseAccess) canAccessAsStudent = true;
      } else if (quiz.planLessonId && quiz.planLesson) {
        const hasPlanAccess = await prisma.planEnrollment.findFirst({
          where: { planId: quiz.planLesson.planId, studentId: session.id, expiresAt: { gt: new Date() } },
          select: { id: true },
        });
        if (hasPlanAccess) canAccessAsStudent = true;
      }

      if (!canAccessAsTeacher && !canAccessAsStudent) {
        return NextResponse.json({ error: "لا يوجد صلاحية للوصول" }, { status: 403 });
      }

      const isStudent = session.role === "student";

      // Check if student already completed this quiz
      if (isStudent) {
        const existingResult = await prisma.quizResult.findUnique({
          where: { studentId_quizId: { studentId: session.id, quizId } },
        });
        if (existingResult) {
          if (!existingResult.allowRetake) {
            return NextResponse.json({
              alreadyCompleted: true,
              result: {
                score: existingResult.score,
                totalQ: existingResult.totalQ,
                completedAt: existingResult.completedAt,
              },
              quiz: { id: quiz.id, title: quiz.title, courseId: quiz.folder?.courseId ?? 'plan', course: quiz.folder?.course },
            });
          }

          // Retake is allowed — check cooldown
          const cooldownHours = (quiz as any).retakeCooldownHours ?? 0;
          if (cooldownHours > 0) {
            const cooldownMs = cooldownHours * 3_600_000;
            const elapsed    = Date.now() - new Date(existingResult.completedAt).getTime();
            if (elapsed < cooldownMs) {
              return NextResponse.json({
                alreadyCompleted: true,
                cooldownRemainingMs: cooldownMs - elapsed,
                result: {
                  score: existingResult.score,
                  totalQ: existingResult.totalQ,
                  completedAt: existingResult.completedAt,
                },
                quiz: { id: quiz.id, title: quiz.title, courseId: quiz.folder?.courseId ?? 'plan', course: quiz.folder?.course },
              });
            }
          }

          // Reset QuizResult for retake
          await prisma.quizResult.update({
            where: { id: existingResult.id },
            data: { startedAt: new Date(), allowRetake: false },
          });
        } else {
          // Create initial QuizResult with startedAt
          await prisma.quizResult.create({
            data: {
              studentId: session.id,
              quizId,
              score: 0,
              totalQ: 0,
              startedAt: new Date(),
              allowRetake: false,
            },
          });
        }
      }

      const questions = isStudent
        ? quiz.questions.map((question: any) => {
            const { correctAnswer: _ca, ...q } = question;
            return q;
          })
        : quiz.questions;

      return NextResponse.json({
        quiz: {
          id: quiz.id,
          title: quiz.title,
          timeLimitMinutes: (quiz as any).timeLimitMinutes,
          questions,
          folderId: quiz.folderId,
          courseId: quiz.folder?.courseId ?? 'plan',
          course: quiz.folder?.course,
        },
        timeLimitMinutes: (quiz as any).timeLimitMinutes,
      });
    } catch (error) {
        console.error("[quizzes/[id]] error:", error);
        return NextResponse.json(
          { error: "حدث خطأ داخلي" },
          { status: 500 }
        );
      }
}