import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Student and Teacher-facing questions for a video.
 *
 * GET — Returns questions.
 *       In teacher/admin preview mode, questions are fully accessible for testing.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: videoId } = await params;

  // Fetch all questions for this video
  const questions = await prisma.videoQuestion.findMany({
    where: { videoId },
    orderBy: { triggerSecond: "asc" },
    select: {
      id: true,
      triggerSecond: true,
      mode: true,
      questionType: true,
      questionText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
      explanation: true,
      refireOnRewatch: true,
      responses: {
        where: { studentId: session.id },
        select: {
          id: true,
          selectedOption: true,
          essayAnswer: true,
          status: true,
          teacherReply: true,
          isCorrect: true,
          watchSessionId: true,
        },
      },
    },
  });

  const isTeacherOrAdmin = session.role === "teacher" || session.role === "admin" || session.role === "superadmin";

  const result = questions.map((q) => {
    const hasAnswered = q.responses.length > 0;
    const latestResponse = hasAnswered ? q.responses[q.responses.length - 1] : null;

    return {
      id: q.id,
      triggerSecond: q.triggerSecond,
      mode: q.mode,
      questionType: q.questionType || "mcq",
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      refireOnRewatch: q.refireOnRewatch,
      ...(hasAnswered && !isTeacherOrAdmin
        ? {
            correctOption: q.correctOption,
            explanation: q.explanation,
            answered: true,
            lastResponse: latestResponse,
          }
        : {
            correctOption: isTeacherOrAdmin ? q.correctOption : undefined,
            explanation: isTeacherOrAdmin ? q.explanation : undefined,
            answered: false,
          }),
    };
  });

  return NextResponse.json({ questions: result });
}
