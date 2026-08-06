import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: planId, lessonId } = await params;

  try {
    const { planHomeworkId, content, fileUrl } = await req.json().catch(() => ({}));
    if (!planHomeworkId) return NextResponse.json({ error: "معرف الواجب مطلوب" }, { status: 400 });
    if (!content && !fileUrl) return NextResponse.json({ error: "محتوى الواجب أو الملف مطلوب" }, { status: 400 });

    const enrollment = await prisma.planEnrollment.findUnique({
      where: { planId_studentId: { planId, studentId: session.id } }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "لم تسجل في هذه الخطة بعد" }, { status: 403 });
    }

    // Expiry check (Gap 23)
    const now = new Date();
    if (enrollment.expiresAt < now) {
      return NextResponse.json({ error: "انتهت صلاحية اشتراكك في هذه الخطة" }, { status: 403 });
    }

    // Verify lesson belongs to plan
    const lesson = await prisma.planLesson.findFirst({
      where: { id: lessonId, planId }
    });
    if (!lesson) {
      return NextResponse.json({ error: "الدرس غير موجود في هذه الخطة" }, { status: 404 });
    }

    // Verify homework belongs to lesson
    const homework = await prisma.planHomework.findFirst({
      where: { id: planHomeworkId, planLessonId: lessonId }
    });
    if (!homework) {
      return NextResponse.json({ error: "الواجب غير موجود في هذا الدرس" }, { status: 404 });
    }

    // Upsert submission
    const submission = await prisma.planHomeworkSubmission.upsert({
      where: {
        planHomeworkId_studentId: {
          planHomeworkId,
          studentId: session.id
        }
      },
      create: {
        planHomeworkId,
        studentId: session.id,
        enrollmentId: enrollment.id,
        content: content || "",
        fileUrl: fileUrl || null,
        status: "pending"
      },
      update: {
        content: content || "",
        fileUrl: fileUrl || null,
        status: "pending",
        submittedAt: now
      }
    });

    return NextResponse.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error("Homework submit error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تسليم الواجب" }, { status: 500 });
  }
}
