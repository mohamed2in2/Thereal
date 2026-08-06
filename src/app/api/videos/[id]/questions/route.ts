import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Student-facing questions for a video.
 *
 * GET — Returns questions without correctOption/explanation (until answered).
 *       Includes which questions this student has already answered.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
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
          isCorrect: true,
          watchSessionId: true,
        },
      },
    },
  });

  // For each question, determine:
  // - If the student has answered it before (any session) → include correctOption + explanation
  // - If not answered yet → hide correctOption + explanation
  const result = questions.map((q) => {
    const hasAnswered = q.responses.length > 0;
    const latestResponse = hasAnswered ? q.responses[q.responses.length - 1] : null;

    return {
      id: q.id,
      triggerSecond: q.triggerSecond,
      mode: q.mode,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      refireOnRewatch: q.refireOnRewatch,
      // Only reveal answer/explanation after the student has answered
      ...(hasAnswered
        ? {
            correctOption: q.correctOption,
            explanation: q.explanation,
            answered: true,
            lastResponse: latestResponse,
          }
        : {
            answered: false,
          }),
    };
  });

  return NextResponse.json({ questions: result });
}
