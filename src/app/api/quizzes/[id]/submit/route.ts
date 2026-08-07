/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: quizId } = await params;
  const body = await req.json();
  const answers = (body?.answers ?? {}) as Record<string, string>;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { order: "asc" } },
      folder: { select: { courseId: true, course: { select: { teacherId: true } } } },
      planLesson: { select: { id: true, planId: true } },
    },
  });

  if (!quiz) return NextResponse.json({ error: "الاختبار غير موجود" }, { status: 404 });

  const canAccessAsTeacher = session.role === "teacher" && (
    (quiz.folder?.course?.teacherId === session.id) ||
    (quiz.planLessonId !== null)
  );

  let canAccessAsStudent = false;
  let planEnrollmentId: string | null = null;

  if (quiz.folderId && quiz.folder) {
    const hasCourseAccess = await prisma.accessCode.findFirst({
      where: {
        courseId: quiz.folder.courseId,
        studentId: session.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (hasCourseAccess) canAccessAsStudent = true;
  } else if (quiz.planLessonId && quiz.planLesson) {
    const enrollment = await prisma.planEnrollment.findFirst({
      where: {
        planId: quiz.planLesson.planId,
        studentId: session.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (enrollment) {
      canAccessAsStudent = true;
      planEnrollmentId = enrollment.id;
    }
  }

  if (!canAccessAsTeacher && !canAccessAsStudent) {
    return NextResponse.json({ error: "لا يوجد صلاحية للوصول" }, { status: 403 });
  }

  const totalQ = quiz.questions.length;
  if (!totalQ) return NextResponse.json({ error: "الاختبار بدون أسئلة" }, { status: 400 });

  // Block retake unless teacher allowed it
  const existingResult = await prisma.quizResult.findUnique({
    where: { studentId_quizId: { studentId: session.id, quizId } },
  });

  if (!existingResult || !existingResult.startedAt) {
    return NextResponse.json(
      { error: "لم يتم بدء الاختبار بشكل صحيح. يرجى بدء الاختبار من الصفحة المخصصة أولاً." },
      { status: 400 }
    );
  }

  if (!existingResult.allowRetake && existingResult.completedAt && (existingResult.score > 0 || existingResult.totalQ > 0)) {
    // Only block if they have already submitted and completed it
    return NextResponse.json(
      { error: "لقد أجبت على هذا الاختبار بالفعل. تواصل مع المعلم للسماح بإعادة المحاولة." },
      { status: 409 }
    );
  }

  const dbStartedAt = existingResult.startedAt;
  const limitMinutes = (quiz as any).timeLimitMinutes ?? 30;
  const elapsedSeconds = Math.floor((Date.now() - dbStartedAt.getTime()) / 1000);
  if (elapsedSeconds > limitMinutes * 60) {
    return NextResponse.json({ error: "انتهى وقت الاختبار" }, { status: 400 });
  }

  const breakdown = quiz.questions.map((question: any) => {
    const yourAnswer = answers[question.id] ?? null;
    const isEssay = question.questionType === "essay";
    const isCorrect = isEssay ? false : yourAnswer === question.correctAnswer;
    return {
      questionId: question.id,
      questionType: question.questionType || (isEssay ? "essay" : "mcq"),
      question: question.question,
      optionA: question.optionA || "",
      optionB: question.optionB || "",
      optionC: question.optionC || "",
      optionD: question.optionD || "",
      yourAnswer: isEssay ? null : yourAnswer,
      essayAnswer: isEssay ? (yourAnswer || "") : null,
      correctAnswer: isEssay ? "" : (question.correctAnswer || "A"),
      isCorrect,
      status: isEssay ? "PENDING" : "APPROVED",
    };
  });

  const hasEssayQuestions = breakdown.some((item: any) => item.questionType === "essay");
  const correct = breakdown.filter((item: any) => item.isCorrect).length;
  const score = Number(((correct / totalQ) * 100).toFixed(2));
  const passed = score >= 50;

  const result = await prisma.quizResult.upsert({
    where: { studentId_quizId: { studentId: session.id, quizId } },
    update: { score, totalQ, completedAt: new Date(), allowRetake: false, startedAt: dbStartedAt },
    create: { studentId: session.id, quizId, score, totalQ, startedAt: dbStartedAt },
  });

  // Save per-question answers (enables "view answers" + "wrong questions exam")
  // Delete old answers for this result first (retake scenario)
  await prisma.quizAnswer.deleteMany({ where: { resultId: result.id } });
  if (breakdown.length > 0) {
    await prisma.quizAnswer.createMany({
      data: (breakdown as any[]).map((b) => ({
        studentId:      session.id,
        quizId,
        questionId:     b.questionId,
        resultId:       result.id,
        questionType:   b.questionType,
        selectedAnswer: b.yourAnswer,
        essayAnswer:    b.essayAnswer,
        correctAnswer:  b.correctAnswer,
        isCorrect:      b.isCorrect,
        status:         b.status,
        question:       b.question,
        optionA:        b.optionA,
        optionB:        b.optionB,
        optionC:        b.optionC,
        optionD:        b.optionD,
      })),
    });
  }

  // Points Logic: Award points only once per achievement milestone (Idempotent)
  if (session.role === "student") {
    const { addPoints, POINTS } = await import("@/lib/points");
    let pointsEarned = 0;
    
    // First try bonus: awarded only on the very first completion if passed
    const isFirstAttempt = !existingResult?.completedAt;
    if (isFirstAttempt && passed) {
      pointsEarned += POINTS.FIRST_TRY_BONUS;
    }
    
    // Perfect score bonus: awarded only if they achieve 100% and hadn't scored 100% previously
    const previousScore = existingResult?.completedAt ? existingResult.score : 0;
    if (score === 100 && previousScore < 100) {
      pointsEarned += POINTS.EXAM_FULL_SCORE;
    }
    
    if (pointsEarned > 0) {
      await addPoints(session.id, pointsEarned);
    }
  }

  // Update Plan Lesson Progress
  if (planEnrollmentId && quiz.planLessonId) {
    await prisma.planLessonProgress.upsert({
      where: {
        enrollmentId_planLessonId: {
          enrollmentId: planEnrollmentId,
          planLessonId: quiz.planLessonId
        }
      },
      create: {
        enrollmentId: planEnrollmentId,
        planLessonId: quiz.planLessonId,
        quizPassed: passed,
        quizScore: score
      },
      update: {
        quizPassed: passed,
        quizScore: score
      }
    });
  }

  return NextResponse.json({
    result,
    correct,
    totalQ,
    score,
    passed,
    breakdown,
    quizTitle: quiz.title,
    courseId: quiz.folder?.courseId ?? 'plan',
  });
}
