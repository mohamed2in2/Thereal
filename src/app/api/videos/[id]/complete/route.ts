import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: videoId } = await params;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { durationMinutes: true, isFree: true }
  });
  if (!video) return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });

  if (!video.isFree) {
    const watchSession = await prisma.videoWatchSession.findFirst({
      where: { videoId, studentId: session.id, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { startedAt: "desc" },
    });
    if (!watchSession) {
      return NextResponse.json({ error: "لا توجد جلسة مشاهدة نشطة لهذا الفيديو" }, { status: 403 });
    }

    const progress = await prisma.progress.findUnique({
      where: { studentId_videoId: { studentId: session.id, videoId } },
      select: { watchedSecondsTotal: true }
    });

    const requiredSeconds = (video.durationMinutes * 60) * 0.8;
    if ((progress?.watchedSecondsTotal ?? 0) < requiredSeconds) {
      return NextResponse.json(
        { error: "يجب مشاهدة 80% من الفيديو على الأقل لإكماله" },
        { status: 400 }
      );
    }
  }

  await prisma.progress.upsert({
    where: { studentId_videoId: { studentId: session.id, videoId } },
    create: { studentId: session.id, videoId, watched: true, watchedAt: new Date() },
    update: { watched: true, watchedAt: new Date() },
  });

  // Track plan lesson progress
  const now = new Date();
  const planSources = await prisma.planLessonSource.findMany({
    where: { videoId },
    include: {
      planLesson: {
        select: {
          id: true,
          planId: true,
        }
      }
    }
  });

  for (const source of planSources) {
    const enrollment = await prisma.planEnrollment.findFirst({
      where: {
        studentId: session.id,
        planId: source.planLesson.planId,
        expiresAt: { gt: now }
      },
      select: { id: true }
    });

    if (enrollment) {
      await prisma.planLessonProgress.upsert({
        where: {
          enrollmentId_planLessonId: {
            enrollmentId: enrollment.id,
            planLessonId: source.planLessonId
          }
        },
        create: {
          enrollmentId: enrollment.id,
          planLessonId: source.planLessonId,
          chosenSourceId: source.id,
          watched: true
        },
        update: {
          chosenSourceId: source.id,
          watched: true
        }
      });
    }
  }

  return NextResponse.json({ success: true });
}
