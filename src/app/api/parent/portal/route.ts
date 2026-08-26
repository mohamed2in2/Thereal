import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateParentToken } from "@/lib/whatsapp/parentToken";
import { parentRateLimiter } from "@/lib/whatsapp/parentRateLimiter";
import { whatsappOrchestrator } from "@/lib/whatsapp/orchestrator";
import { averagePercent, examResultPercent, quizResultPercent } from "@/lib/scoring";

const TOKEN_MAX_LEN = 500;

function maskPhone(phone: string | null): string {
  if (!phone) return "••••";
  const clean = phone.trim();
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const rateCheck = parentRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `تم تجاوز حد الزيارات المسموح به. يرجى الانتظار لمدة ${rateCheck.resetInSeconds} ثانية.` },
        { status: 429 }
      );
    }

    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ success: true, stage: "DEAD" });

    // Guard against huge token strings
    if (token.length > TOKEN_MAX_LEN) return NextResponse.json({ success: true, stage: "DEAD" });

    const userAgent = req.headers.get("user-agent") || undefined;
    const parentToken = await validateParentToken(token, ip, userAgent);
    if (!parentToken || !parentToken.student) {
      return NextResponse.json({ success: true, stage: "DEAD" });
    }

    const student = parentToken.student;
    const studentId = student.id;

    const waConfig = await whatsappOrchestrator.getConfig();
    const requireVerification = waConfig.requireParentVerification;

    if (requireVerification && parentToken.status === "PENDING") {
      return NextResponse.json({
        success: true,
        stage: "GATE",
        child: {
          name: student.name,
          stage: student.educationalStage || null,
          maskedStudentPhone: maskPhone(student.phone),
        },
      });
    }

    // Fetch all academic data in parallel — these 5 queries are independent
    const [quizResults, dailyExamResults, homeworkSubmissions, feedbacks, subscriptions] =
      await Promise.all([
        prisma.quizResult.findMany({
          where: { studentId },
          include: { quiz: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
        prisma.dailyExamResult.findMany({
          where: { studentId },
          include: { exam: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
        prisma.homeworkSubmission.findMany({
          where: { studentId },
          include: { homework: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
        prisma.studentFeedback.findMany({
          where: { studentId },
          include: { teacher: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.teacherSubscription.findMany({
          where: { studentId, status: "active" },
          include: { teacher: { select: { id: true, name: true, phone: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const validQuizResults = quizResults.filter(
      (q) => typeof q.totalQ === "number" && q.totalQ > 0
    );
    const validExamResults = dailyExamResults.filter(
      (e) => typeof e.totalQ === "number" && e.totalQ > 0
    );

    const overallAveragePercent = averagePercent(validQuizResults, validExamResults);

    let overallStatusBadge: { label: string; color: string; text: string } | null = null;
    if (overallAveragePercent !== null) {
      if (overallAveragePercent >= 85) {
        overallStatusBadge = { label: "ممتاز", color: "emerald", text: "التزام ممتاز وحضور منتظم" };
      } else if (overallAveragePercent >= 65) {
        overallStatusBadge = { label: "كويس، ومحتاج شوية تحسين", color: "amber", text: "أداء جيد ويمكن تحسينه" };
      } else {
        overallStatusBadge = { label: "محتاج متابعة", color: "rose", text: "يرجى التواصل مع معلم المادة" };
      }
    }

    const completedHomeworkCount = homeworkSubmissions.filter(
      (h) => h.status === "GRADED" || h.status === "SUBMITTED"
    ).length;
    const pendingHomeworkCount = homeworkSubmissions.filter((h) => h.status === "PENDING").length;

    const recentExams = [
      ...validQuizResults.map((q) => {
        const pct = Math.round(quizResultPercent(q));
        return {
          title: q.quiz?.title || "اختبار تفاعلي",
          score: pct,
          maxScore: 100,
          percent: pct,
          status: pct >= 85 ? "🟢" : pct >= 65 ? "🟡" : "🔴",
          date: q.completedAt.toISOString().split("T")[0],
        };
      }),
      ...validExamResults.map((e) => {
        const pct = Math.round(examResultPercent(e));
        return {
          title: e.exam?.title || "امتحان لوحة الشرف",
          score: e.score,
          maxScore: e.totalQ,
          percent: pct,
          status: pct >= 85 ? "🟢" : pct >= 65 ? "🟡" : "🔴",
          date: e.completedAt.toISOString().split("T")[0],
        };
      }),
    ].slice(0, 8);

    return NextResponse.json({
      success: true,
      stage: "REPORT",
      student: {
        id: student.id,
        name: student.name,
        educationalStage: student.educationalStage || null,
        points: student.points,
        parentPhone: student.parentPhone || null,
        phone: student.phone || null,
      },
      overallAveragePercent,
      overallStatusBadge,
      attendancePercent: null,
      homeworkStats: { completed: completedHomeworkCount, pending: pendingHomeworkCount, late: null },
      recentExams,
      teacherNotes: feedbacks.map((f) => ({
        teacherName: f.teacher?.name || "المعلم",
        content: f.content,
        date: f.createdAt.toISOString().split("T")[0],
      })),
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        teacherName: sub.teacher?.name || "المعلم",
        teacherPhone: sub.teacher?.phone || null,
        planLabel: sub.planLabel,
        amount: sub.amount,
        createdAt: sub.createdAt.toISOString().split("T")[0],
        status: sub.status,
      })),
    });
  } catch (err) {
    // Do not leak internal error messages
    console.error("[parent/portal] error:", err);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
