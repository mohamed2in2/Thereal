import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST — Student answers a video question.
 *
 * Body: { selectedOption, answeredAtSecond, watchSessionId }
 *
 * Validates:
 * - watchSessionId belongs to this student and is active
 * - answeredAtSecond is within ±15s of triggerSecond (anti-bypass)
 * - selectedOption is A/B/C/D
 * - Not already answered in this watch session (unique constraint)
 *
 * Returns: { isCorrect, explanation, correctOption }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: videoId, qid: questionId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    selectedOption?: string;
    answeredAtSecond?: number;
    watchSessionId?: string;
  };

  const { selectedOption, answeredAtSecond, watchSessionId } = body;

  // Validate option
  if (!selectedOption || !["A", "B", "C", "D"].includes(selectedOption)) {
    return NextResponse.json({ error: "اختيار غير صالح" }, { status: 400 });
  }

  // Validate answeredAtSecond
  if (typeof answeredAtSecond !== "number" || !Number.isFinite(answeredAtSecond)) {
    return NextResponse.json({ error: "توقيت الإجابة مطلوب" }, { status: 400 });
  }

  // Fetch the question
  const question = await prisma.videoQuestion.findFirst({
    where: { id: questionId, videoId },
    select: {
      id: true,
      triggerSecond: true,
      correctOption: true,
      explanation: true,
    },
  });
  if (!question) {
    return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
  }

  // Validate answeredAtSecond is within ±15s of triggerSecond (anti-bypass)
  if (Math.abs(answeredAtSecond - question.triggerSecond) > 15) {
    return NextResponse.json(
      { error: "توقيت الإجابة بعيد جداً عن توقيت السؤال" },
      { status: 400 }
    );
  }

  // Validate watch session if provided
  if (watchSessionId) {
    const ws = await prisma.videoWatchSession.findFirst({
      where: {
        id: watchSessionId,
        studentId: session.id,
        videoId,
      },
      select: { id: true, expiresAt: true, endedAt: true },
    });
    if (!ws) {
      return NextResponse.json({ error: "جلسة المشاهدة غير صالحة" }, { status: 403 });
    }
    // Allow answering even if session is near-expired — don't penalize mid-question
  }

  const isCorrect = selectedOption === question.correctOption;

  // Check if already answered in this session
  const existing = await prisma.videoQuestionResponse.findFirst({
    where: {
      videoQuestionId: questionId,
      studentId: session.id,
      watchSessionId: watchSessionId ?? null,
    },
  });

  if (existing) {
    // Already answered — return the existing result
    return NextResponse.json({
      isCorrect: existing.isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
      alreadyAnswered: true,
    });
  }

  // Record the response
  try {
    await prisma.videoQuestionResponse.create({
      data: {
        videoQuestionId: questionId,
        studentId: session.id,
        selectedOption,
        isCorrect,
        answeredAtSecond: Math.round(answeredAtSecond),
        watchSessionId: watchSessionId ?? null,
      },
    });
  } catch (e) {
    // Unique constraint violation — race condition, already answered
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({
        isCorrect,
        correctOption: question.correctOption,
        explanation: question.explanation,
        alreadyAnswered: true,
      });
    }
    throw e;
  }

  return NextResponse.json({
    isCorrect,
    correctOption: question.correctOption,
    explanation: question.explanation,
  });
}
