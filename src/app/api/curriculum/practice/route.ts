import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ContentProgressStatus,
  ContentType,
  recordContentProgress,
} from "@/lib/content-access-engine";
import { getCurriculumQuestion } from "@/lib/curriculum-programming-questions";

const SOURCE_PREFIX = "curriculum-programming:";

async function getProgress(studentId: string) {
  const entries = await prisma.studentContentProgress.findMany({
    where: {
      studentId,
      content: {
        type: ContentType.QUIZ,
        sourceId: { startsWith: SOURCE_PREFIX },
      },
    },
    select: { score: true, content: { select: { sourceId: true } } },
  });
  const correctCount = entries.filter((entry) => (entry.score ?? 0) >= 100).length;
  return {
    completedCount: entries.length,
    correctCount,
    score: entries.length ? Math.round((correctCount / entries.length) * 100) : 0,
    completedQuestionIds: entries.map((entry) => entry.content.sourceId.slice(SOURCE_PREFIX.length)),
  };
}

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return NextResponse.json(await getProgress(session.id));
}

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    questionId?: unknown;
    choice?: unknown;
  } | null;
  if (typeof body?.questionId !== "string" || typeof body.choice !== "string") {
    return NextResponse.json({ error: "بيانات الإجابة غير صحيحة" }, { status: 400 });
  }

  const question = getCurriculumQuestion(body.questionId);
  if (!question || !question.choices.includes(body.choice)) {
    return NextResponse.json({ error: "السؤال أو الاختيار غير صحيح" }, { status: 400 });
  }

  const correct = body.choice === question.answer;
  await recordContentProgress(
    session.id,
    {
      type: ContentType.QUIZ,
      sourceId: `${SOURCE_PREFIX}${question.id}`,
      title: `${question.lessonNumber} - ${question.lessonTitle}`,
    },
    {
      status: ContentProgressStatus.COMPLETED,
      score: correct ? 100 : 0,
      completedAt: new Date(),
    }
  );

  return NextResponse.json({
    correct,
    explanation: question.explanation,
    revisionPrompt: correct ? null : question.revisionPrompt,
    progress: await getProgress(session.id),
  });
}
