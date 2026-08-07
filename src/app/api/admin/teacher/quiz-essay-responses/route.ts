import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

/**
 * Teacher API for reviewing and grading Quiz/Test essay questions.
 *
 * GET   — List student quiz essay answers for teacher's courses.
 * PATCH — Approve / Disapprove an essay answer, update quiz score, and send feedback note.
 */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get("status"); // "PENDING" | "APPROVED" | "DISAPPROVED" | "all"
  const quizId = searchParams.get("quizId");
  const courseId = searchParams.get("courseId");

  const whereClause: any = {
    OR: [
      { questionType: "essay" },
      { essayAnswer: { not: null } },
    ],
    ...(session.role !== "superadmin"
      ? {
          result: {
            quiz: {
              folder: {
                course: { teacherId: session.id },
              },
            },
          },
        }
      : {}),
  };

  if (statusParam && statusParam !== "all") {
    whereClause.status = statusParam;
  }
  if (quizId) {
    whereClause.quizId = quizId;
  } else if (courseId) {
    whereClause.result = {
      ...whereClause.result,
      quiz: { folder: { courseId } },
    };
  }

  const answers = await prisma.quizAnswer.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      result: {
        select: {
          id: true,
          score: true,
          totalQ: true,
          quiz: {
            select: {
              id: true,
              title: true,
              folder: {
                select: {
                  course: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
          student: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ answers });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (session && session.role === "superadmin") {
    try {
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "SUPERADMIN_ACTION",
        targetType: "API_ROUTE",
        targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
        targetName: req.method,
      });
    } catch {}
  }
  if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    answerId?: string;
    status?: "APPROVED" | "DISAPPROVED";
    teacherReply?: string;
  };

  const { answerId, status, teacherReply } = body;

  if (!answerId || !status || !["APPROVED", "DISAPPROVED"].includes(status)) {
    return NextResponse.json(
      { error: "بيانات غير صالحة: answerId و status مطلوبان" },
      { status: 400 }
    );
  }

  // Verify ownership
  const answer = await prisma.quizAnswer.findFirst({
    where: {
      id: answerId,
      ...(session.role !== "superadmin"
        ? {
            result: {
              quiz: {
                folder: { course: { teacherId: session.id } },
              },
            },
          }
        : {}),
    },
    include: {
      result: {
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              folder: { select: { courseId: true } },
            },
          },
          answers: true,
          student: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!answer) {
    return NextResponse.json({ error: "الإجابة غير موجودة" }, { status: 404 });
  }

  const isApproved = status === "APPROVED";

  // Update the quiz answer record
  const updatedAnswer = await prisma.quizAnswer.update({
    where: { id: answerId },
    data: {
      status,
      isCorrect: isApproved,
      teacherReply: teacherReply?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  // Recalculate student overall quiz score
  const allAnswers = await prisma.quizAnswer.findMany({
    where: { resultId: answer.resultId },
  });

  const correctCount = allAnswers.filter((a) => a.isCorrect).length;
  const totalQ = answer.result.totalQ || allAnswers.length || 1;
  const newScore = Number(((correctCount / totalQ) * 100).toFixed(2));

  await prisma.quizResult.update({
    where: { id: answer.resultId },
    data: { score: newScore },
  });

  // Notify student
  try {
    const quizTitle = answer.result.quiz.title;
    const courseId = answer.result.quiz.folder?.courseId;

    await prisma.notification.create({
      data: {
        userId: answer.studentId,
        type: "grade_resolved",
        title: isApproved ? "✅ تم تصحيح وقبول إجابتك المقالية" : "❌ تم تصحيح إجابتك المقالية",
        body: `قام المعلم بمراجعة وتصحيح إجابتك المقالية في اختبار (${quizTitle}). الدرجة النهائية الجديدة: ${newScore}%. ${
          teacherReply?.trim() ? `ملاحظات المعلم: "${teacherReply.trim()}"` : ""
        }`,
        link: courseId ? `/courses/${courseId}` : `/quizzes/${answer.quizId}`,
      },
    });
  } catch (err) {
    console.error("Failed to notify student for quiz essay grade:", err);
  }

  return NextResponse.json({ updatedAnswer, newScore });
}
