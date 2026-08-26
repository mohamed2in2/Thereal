/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkQuizAccess } from "@/lib/authorization";
import { canAccessContent, ContentType } from "@/lib/content-access-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });
    }

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

    if (!quiz) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" },
        { status: 404 }
      );
    }

    const hasAccess = await checkQuizAccess(session.id, session.role, quizId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0644\u0648\u0635\u0648\u0644" },
        { status: 403 }
      );
    }

    const isStudent = session.role === "student";

    if (isStudent) {
      const access = await canAccessContent(session.id, {
        type: ContentType.QUIZ,
        sourceId: quizId,
        title: quiz.title,
      });
      if ("requiredItem" in access) {
        return NextResponse.json(
          {
            error: `\u064A\u062C\u0628 \u0625\u0643\u0645\u0627\u0644 \u00AB${access.requiredItem.title}\u00BB \u0623\u0648\u0644\u064B\u0627.`,
            code: access.code,
            requiredItem: access.requiredItem,
          },
          { status: 403 }
        );
      }
    }

    // Atomic upsert: avoids race condition between findUnique + create
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
            quiz: {
              id: quiz.id,
              title: quiz.title,
              courseId: quiz.folder?.courseId ?? "plan",
              course: quiz.folder?.course,
            },
          });
        }

        // Retake allowed — check cooldown
        const cooldownHours = (quiz as any).retakeCooldownHours ?? 0;
        if (cooldownHours > 0) {
          const cooldownMs = cooldownHours * 3_600_000;
          const elapsed = Date.now() - new Date(existingResult.completedAt).getTime();
          if (elapsed < cooldownMs) {
            return NextResponse.json({
              alreadyCompleted: true,
              cooldownRemainingMs: cooldownMs - elapsed,
              result: {
                score: existingResult.score,
                totalQ: existingResult.totalQ,
                completedAt: existingResult.completedAt,
              },
              quiz: {
                id: quiz.id,
                title: quiz.title,
                courseId: quiz.folder?.courseId ?? "plan",
                course: quiz.folder?.course,
              },
            });
          }
        }

        // Reset for retake
        await prisma.quizResult.update({
          where: { id: existingResult.id },
          data: { startedAt: new Date(), allowRetake: false },
        });
      } else {
        // Upsert prevents duplicate-key errors from concurrent requests
        await prisma.quizResult
          .upsert({
            where: { studentId_quizId: { studentId: session.id, quizId } },
            create: {
              studentId: session.id,
              quizId,
              score: 0,
              totalQ: 0,
              startedAt: new Date(),
              allowRetake: false,
            },
            update: { startedAt: new Date() },
          })
          .catch((e: any) => {
            // P2002 unique constraint is benign here (concurrent duplicate)
            if (e?.code !== "P2002") throw e;
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
        courseId: quiz.folder?.courseId ?? "plan",
        course: quiz.folder?.course,
      },
      timeLimitMinutes: (quiz as any).timeLimitMinutes,
    });
  } catch (error) {
    console.error("[quizzes/[id]] error:", error);
    return NextResponse.json(
      { error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A" },
      { status: 500 }
    );
  }
}
