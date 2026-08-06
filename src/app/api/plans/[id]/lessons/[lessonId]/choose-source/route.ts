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
    const { sourceId } = await req.json().catch(() => ({}));
    if (!sourceId) return NextResponse.json({ error: "معرف المصدر مطلوب" }, { status: 400 });

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

    // Verify source belongs to lesson
    const source = await prisma.planLessonSource.findFirst({
      where: { id: sourceId, planLessonId: lessonId }
    });
    if (!source) {
      return NextResponse.json({ error: "مصدر الفيديو غير موجود" }, { status: 404 });
    }

    // Upsert PlanLessonProgress with chosenSourceId
    await prisma.planLessonProgress.upsert({
      where: {
        enrollmentId_planLessonId: {
          enrollmentId: enrollment.id,
          planLessonId: lessonId
        }
      },
      create: {
        enrollmentId: enrollment.id,
        planLessonId: lessonId,
        chosenSourceId: sourceId
      },
      update: {
        chosenSourceId: sourceId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Choose source error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حفظ اختيارك" }, { status: 500 });
  }
}
