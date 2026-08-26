import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quizResultPercent } from "@/lib/scoring";

export async function GET() {
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    // Non-students have no quiz results — return empty gracefully
    if (session.role !== "student") return NextResponse.json({ results: [], total: 0 });

    const results = await prisma.quizResult.findMany({
      where: { studentId: session.id },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        score: true,
        totalQ: true,
        startedAt: true,
        completedAt: true,
        allowRetake: true,
        quiz: {
          select: {
            id: true,
            title: true,
            timeLimitMinutes: true,
            folder: {
              select: {
                course: { select: { id: true, title: true, subject: true } },
              },
            },
          },
        },
        answers: {
          select: { isCorrect: true, selectedAnswer: true },
        },
      },
    });

    const shaped = results.map((r, idx) => {
      const attempted = r.answers.filter((a) => a.selectedAnswer !== null).length;
      const correct = r.answers.filter((a) => a.isCorrect).length;
      return {
        serial: idx + 1,
        id: r.id,
        quizId: r.quiz.id,
        quizTitle: r.quiz.title,
        courseTitle: r.quiz.folder?.course?.title ?? "خطة دراسية",
        subject: r.quiz.folder?.course?.subject ?? "عام",
        courseId: r.quiz.folder?.course?.id ?? "plan",
        totalQ: r.totalQ,
        score: r.score,
        pct: Math.round(quizResultPercent(r)),
        attempted,
        correct,
        hasAnswers: r.answers.length > 0,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        allowRetake: r.allowRetake,
      };
    });

    return NextResponse.json(
      { results: shaped, total: shaped.length },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("[student/results] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
