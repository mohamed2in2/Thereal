import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateProjectWithAI } from "@/lib/plan-grading";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: planId, lessonId } = await params;

  try {
    const { content, fileUrl } = await req.json().catch(() => ({}));
    
    // Content limit (Gap 21)
    const normalizedContent = String(content || "").trim();
    if (!normalizedContent && !fileUrl) {
      return NextResponse.json({ error: "محتوى المشروع أو الرابط مطلوب" }, { status: 400 });
    }
    if (normalizedContent.length > 10000) {
      return NextResponse.json({ error: "محتوى المشروع طويل جداً (الحد الأقصى 10000 حرف)" }, { status: 400 });
    }

    const enrollment = await prisma.planEnrollment.findUnique({
      where: { planId_studentId: { planId, studentId: session.id } },
      include: { plan: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "لم تسجل في هذه الخطة بعد" }, { status: 403 });
    }

    // Expiry check (Gap 23)
    const now = new Date();
    if (enrollment.expiresAt < now) {
      return NextResponse.json({ error: "انتهت صلاحية اشتراكك في هذه الخطة" }, { status: 403 });
    }

    // Verify lesson belongs to plan and has project enabled
    const lesson = await prisma.planLesson.findFirst({
      where: { id: lessonId, planId }
    });
    if (!lesson) {
      return NextResponse.json({ error: "الدرس غير موجود في هذه الخطة" }, { status: 404 });
    }
    if (!lesson.hasProject) {
      return NextResponse.json({ error: "هذا الدرس لا يتطلب مشروعاً عملياً" }, { status: 400 });
    }

    // Check for existing submission for this student and lesson to prevent duplicates
    const existing = await prisma.planProjectSubmission.findFirst({
      where: { studentId: session.id, planLessonId: lessonId }
    });

    let submission;
    if (existing) {
      submission = await prisma.planProjectSubmission.update({
        where: { id: existing.id },
        data: {
          content: normalizedContent,
          fileUrl: fileUrl || null,
          status: "pending",
          grade: null,
          feedback: null,
          retryCount: 0,
          submittedAt: now,
          gradedAt: null
        }
      });
    } else {
      submission = await prisma.planProjectSubmission.create({
        data: {
          enrollmentId: enrollment.id,
          studentId: session.id,
          planLessonId: lessonId,
          content: normalizedContent,
          fileUrl: fileUrl || null,
          status: "pending"
        }
      });
    }

    // Fire-and-forget AI evaluation if enabled (Gap 8)
    if (enrollment.plan.gradingAIEnabled) {
      // Execute asynchronously in background
      evaluateProjectWithAI(submission.id).catch(err => {
        console.error("Background AI grading trigger error:", err);
      });
    }

    return NextResponse.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error("Project submit error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تسليم المشروع" }, { status: 500 });
  }
}
