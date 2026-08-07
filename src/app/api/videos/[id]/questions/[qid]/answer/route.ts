import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST — Student or Teacher answers a video question.
 *
 * Body: { selectedOption, answeredAtSecond, watchSessionId }
 *
 * Validates:
 * - watchSessionId belongs to this user (or preview session)
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: videoId, qid: questionId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    selectedOption?: string;
    essayAnswer?: string;
    answeredAtSecond?: number;
    watchSessionId?: string;
  };

  const { selectedOption, essayAnswer, answeredAtSecond, watchSessionId } = body;

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
      questionType: true,
      correctOption: true,
      explanation: true,
    },
  });
  if (!question) {
    return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
  }

  const isEssay = question.questionType === "essay";

  // Validation based on question type
  if (isEssay) {
    if (!essayAnswer?.trim()) {
      return NextResponse.json({ error: "يرجى كتابة الإجابة المقالية" }, { status: 400 });
    }
  } else {
    if (!selectedOption || !["A", "B", "C", "D"].includes(selectedOption)) {
      return NextResponse.json({ error: "اختيار غير صالح" }, { status: 400 });
    }
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
  }

  const isCorrect = isEssay ? false : selectedOption === question.correctOption;
  const status = isEssay ? "PENDING" : "APPROVED";

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
      status: existing.status,
      essayAnswer: existing.essayAnswer,
      teacherReply: existing.teacherReply,
      alreadyAnswered: true,
    });
  }

  // Record the response
  try {
    await prisma.videoQuestionResponse.create({
      data: {
        videoQuestionId: questionId,
        studentId: session.id,
        selectedOption: isEssay ? null : selectedOption!,
        essayAnswer: isEssay ? essayAnswer!.trim() : null,
        isCorrect,
        status,
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
        status,
        alreadyAnswered: true,
      });
    }
    throw e;
  }

  return NextResponse.json({
    isCorrect,
    correctOption: question.correctOption,
    explanation: question.explanation,
    status,
    isEssay,
    message: isEssay ? "تم إرسال إجابتك المقالية بنجاح وسيقوم المعلم بمراجعتها" : undefined,
  });
}
