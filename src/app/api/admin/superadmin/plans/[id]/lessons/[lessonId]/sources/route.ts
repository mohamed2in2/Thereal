import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, lessonId } = await params;

  try {
    const body = await req.json();
    const { videoId, isDefault } = body;

    if (!videoId) {
      return NextResponse.json({ error: "الفيديو مطلوب" }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { folder: { include: { course: true } } }
    });

    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const existingSource = await prisma.planLessonSource.findFirst({
      where: { planLessonId: lessonId, videoId }
    });

    if (existingSource) {
      return NextResponse.json({ error: "الفيديو موجود بالفعل كمصدر لهذا الدرس" }, { status: 400 });
    }

    // Count existing sources for this lesson
    const existingCount = await prisma.planLessonSource.count({
      where: { planLessonId: lessonId }
    });

    // Auto-set as default if this is the first source, or if explicitly requested
    const shouldBeDefault = isDefault === true || existingCount === 0;

    // If marking as default, unset others first
    if (shouldBeDefault) {
      await prisma.planLessonSource.updateMany({
        where: { planLessonId: lessonId },
        data: { isDefault: false }
      });
    }

    const source = await prisma.planLessonSource.create({
      data: {
        planLessonId: lessonId,
        videoId,
        teacherId: video.folder.course.teacherId,
        isDefault: shouldBeDefault,
        isManual: true,
      },
      include: { video: { select: { title: true } } }
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "ADD_PLAN_LESSON_SOURCE",
      targetType: "Plan", targetId: "sys", targetName: "action",
      metadata: { details: `Added video ${videoId} (isDefault=${shouldBeDefault}) to lesson ${lessonId} in plan ${planId}` },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error("Failed to add plan lesson source:", error);
    return NextResponse.json({ error: "تعذر إضافة المصدر" }, { status: 500 });
  }
}
