import { NextRequest, NextResponse } from "next/server";
import { getSession, getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeQuizAnswer } from "@/lib/ai-assistant";

const REASON_MIN = 20;
const REASON_MAX = 2000;
const SCORE_MIN = 0;
const SCORE_MAX = 100;

// POST — student requests grade adjustment (with AI analysis)
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { quizId, reason, requestedScore, questionEvidence } = body as {
      quizId?: unknown;
      reason?: unknown;
      requestedScore?: unknown;
      questionEvidence?: { questionId?: string; studentAnswer?: string } | null;
    };

    if (!quizId || typeof quizId !== "string" || quizId.trim().length === 0) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string") {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    if (reason.length < REASON_MIN) {
      return NextResponse.json(
        { error: `السبب قصير جدًا، اكتب وصفًا مفصلًا (${REASON_MIN} حرف على الأقل)` },
        { status: 400 }
      );
    }
    if (reason.length > REASON_MAX) {
      return NextResponse.json(
        { error: `السبب طويل جدًا (${REASON_MAX} حرف كحد أقصى)` },
        { status: 400 }
      );
    }

    // Validate requestedScore when provided
    let safeRequestedScore: number | null = null;
    if (requestedScore !== undefined && requestedScore !== null) {
      const parsed = Number(requestedScore);
      if (!Number.isFinite(parsed) || parsed < SCORE_MIN || parsed > SCORE_MAX) {
        return NextResponse.json(
          { error: `الدرجة المطلوبة يجب أن تكون بين ${SCORE_MIN} و ${SCORE_MAX}` },
          { status: 400 }
        );
      }
      safeRequestedScore = parsed;
    }

    // Get the quiz result for current score
    const result = await prisma.quizResult.findFirst({
      where: { quizId: quizId.trim(), studentId: session.id },
      include: {
        quiz: {
          include: {
            questions: true,
            folder: { select: { courseId: true } },
          },
        },
      },
    });

    if (!result) {
      return NextResponse.json(
        { error: "لم يتم حل هذا الكويز بعد" },
        { status: 404 }
      );
    }

    // Check for existing pending request to avoid spam
    const existing = await prisma.gradeAdjustmentRequest.findFirst({
      where: {
        studentId: session.id,
        quizId: quizId.trim(),
        status: { in: ["pending", "ai_reviewed"] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "لديك طلب تعديل لنفس الكويز قيد المراجعة بالفعل" },
        { status: 409 }
      );
    }

    // AI analysis if specific question evidence provided
    let aiAnalysis: string | null = null;
    let confidence = 0;
    if (questionEvidence?.questionId) {
      const q = result.quiz.questions.find((qq) => qq.id === questionEvidence.questionId);
      if (q) {
        const options = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
        const analysis = await analyzeQuizAnswer(
          q.question,
          questionEvidence.studentAnswer ?? "",
          q.correctAnswer,
          options
        );
        aiAnalysis = `تحليل الذكاء الاصطناعي:\n${analysis.reasoning}\n(الثقة: ${Math.round(analysis.confidence * 100)}%)`;
        confidence = analysis.confidence;
      }
    }

    const status = confidence > 0.7 ? "ai_reviewed" : "pending";

    const request_ = await prisma.gradeAdjustmentRequest.create({
      data: {
        studentId: session.id,
        quizId: quizId.trim(),
        courseId: result.quiz.folder?.courseId ?? null,
        requestedBy: "student",
        currentScore: result.score,
        requestedScore: safeRequestedScore,
        reason,
        aiAnalysis,
        evidence: questionEvidence ? JSON.stringify(questionEvidence) : null,
        status,
      },
    });

    return NextResponse.json({
      request: request_,
      message: "تم تقديم طلبك للمعلم، سيتم مراجعته قريبًا",
    });
  } catch (err) {
    console.error("Grade request POST error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// GET — list grade requests (for student: own; for teacher: their courses)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const statusParam = req.nextUrl.searchParams.get("status");
    // Only pass status to Prisma if it's a known value
    const ALLOWED_STATUSES = ["pending", "ai_reviewed", "approved", "rejected"] as const;
    const statusFilter =
      statusParam && (ALLOWED_STATUSES as readonly string[]).includes(statusParam)
        ? { status: statusParam }
        : {};

    if (session.role === "student") {
      const requests = await prisma.gradeAdjustmentRequest.findMany({
        where: { studentId: session.id, ...statusFilter },
        orderBy: { createdAt: "desc" },
        include: {
          quiz: { select: { title: true } },
          course: { select: { title: true } },
        },
      });
      return NextResponse.json({ requests });
    }

    if (session.role === "teacher") {
      const courses = await prisma.course.findMany({
        where: { teacherId: session.id },
        select: { id: true },
      });
      const courseIds = courses.map((c) => c.id);

      const requests = await prisma.gradeAdjustmentRequest.findMany({
        where: { courseId: { in: courseIds }, ...statusFilter },
        orderBy: { createdAt: "desc" },
        include: {
          quiz: { select: { title: true } },
          course: { select: { title: true } },
          student: { select: { name: true, email: true, phone: true } },
        },
      });
      return NextResponse.json({ requests });
    }

    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  } catch (err) {
    console.error("Grade requests GET error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
