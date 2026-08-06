import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/student/results/[id] — per-question breakdown for answer review modal */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;

  const result = await prisma.quizResult.findUnique({
    where: { id },
    select: {
      studentId: true,
      score: true,
      totalQ: true,
      startedAt: true,
      completedAt: true,
      quiz: { select: { title: true, folder: { select: { course: { select: { title: true } } } } } },
      answers: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          question: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          selectedAnswer: true,
          correctAnswer: true,
          isCorrect: true,
        },
      },
    },
  });

  if (!result) return NextResponse.json({ error: "النتيجة غير موجودة" }, { status: 404 });
  if (result.studentId !== session.id) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  return NextResponse.json({ result });
}
