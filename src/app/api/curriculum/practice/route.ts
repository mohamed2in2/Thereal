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

async function getTopCurriculumStudents() {
  try {
    const topGroups = await prisma.studentContentProgress.groupBy({
      by: ["studentId"],
      where: {
        content: {
          type: ContentType.QUIZ,
          sourceId: { startsWith: SOURCE_PREFIX },
        },
        score: { gte: 100 },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 3,
    });

    const userIds = topGroups.map((g) => g.studentId);
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, isDeleted: false },
          select: { id: true, name: true, points: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));
    const results: { rank: number; studentId: string; name: string; correctCount: number; points: number }[] = [];

    for (let i = 0; i < topGroups.length; i++) {
      const g = topGroups[i];
      const u = userMap.get(g.studentId);
      if (u) {
        results.push({
          rank: i + 1,
          studentId: g.studentId,
          name: u.name?.trim() || `طالب متفوق`,
          correctCount: g._count.id,
          points: u.points || 0,
        });
      }
    }

    if (results.length < 3) {
      const existingIds = results.map((r) => r.studentId);
      const fallbackUsers = await prisma.user.findMany({
        where: {
          role: "student",
          isDeleted: false,
          ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
        },
        orderBy: { points: "desc" },
        take: 3 - results.length,
        select: { id: true, name: true, points: true },
      });

      for (const fu of fallbackUsers) {
        results.push({
          rank: results.length + 1,
          studentId: fu.id,
          name: fu.name?.trim() || `طالب مميز`,
          correctCount: 0,
          points: fu.points || 0,
        });
      }
    }

    results.sort((a, b) => b.correctCount - a.correctCount || b.points - a.points);
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return results;
  } catch (err) {
    console.error("Error getting top curriculum students:", err);
    return [];
  }
}

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const [progress, topStudents] = await Promise.all([
    getProgress(session.id),
    getTopCurriculumStudents(),
  ]);
  return NextResponse.json({
    ...progress,
    topStudents,
  });
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

  const [progress, topStudents] = await Promise.all([
    getProgress(session.id),
    getTopCurriculumStudents(),
  ]);

  return NextResponse.json({
    correct,
    explanation: question.explanation,
    revisionPrompt: correct ? null : question.revisionPrompt,
    progress,
    topStudents,
  });
}
