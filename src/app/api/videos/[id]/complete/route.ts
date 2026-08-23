import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessContent,
  ContentType,
  recordContentCompleted,
} from "@/lib/content-access-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: videoId } = await params;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { title: true, durationMinutes: true, isFree: true }
  });
  if (!video) return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });

  const access = await canAccessContent(session.id, {
    type: ContentType.VIDEO,
    sourceId: videoId,
    title: video.title,
  });
  if ("requiredItem" in access) {
    return NextResponse.json(
      {
        error: `يجب إكمال «${access.requiredItem.title}» أولًا.`,
        code: access.code,
        requiredItem: access.requiredItem,
      },
      { status: 403 }
    );
  }

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
    if (watchSession) {
      const { releaseViewerBandwidth } = await import("@/lib/vdocipher-accounts");
      await releaseViewerBandwidth(watchSession.sessionToken, { completed: true }).catch(() => {});
    }
  }

  const completedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.progress.upsert({
      where: { studentId_videoId: { studentId: session.id, videoId } },
      create: { studentId: session.id, videoId, watched: true, watchedAt: completedAt },
      update: { watched: true, watchedAt: completedAt },
    });
    await recordContentCompleted(
      session.id,
      { type: ContentType.VIDEO, sourceId: videoId, title: video.title },
      { completedAt },
      tx
    );
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
