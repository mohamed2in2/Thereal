import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveEmbedUrl } from "@/lib/video-provider";
import { isScheduledLocked, unlockAtISO } from "@/lib/publish";
import { prisma } from "@/lib/prisma";
import { checkVideoAccess } from "@/lib/authorization";

function scheduledResponse(folderPublishAt: Date | null, videoPublishAt: Date | null) {
  return NextResponse.json(
    {
      error: "هذه المحاضرة لم تُفتح بعد. ستتاح في موعدها المحدد.",
      code: "SCHEDULED",
      unlockAt: unlockAtISO(folderPublishAt, videoPublishAt),
    },
    { status: 403 }
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ── FREE / DEMO video: resolvable by anyone (even anonymous), no session ──
  const freeProbe = await prisma.video.findUnique({ where: { id }, select: { isFree: true } });
  if (!freeProbe) {
    return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
  }
  if (freeProbe.isFree) {
    const video = await prisma.video.findUnique({
      where: { id },
      include: { folder: { select: { publishAt: true } } },
    });
    if (video && isScheduledLocked(video.folder.publishAt, video.publishAt)) {
      return scheduledResponse(video.folder.publishAt, video.publishAt);
    }
    try {
      const result = await resolveEmbedUrl(video!);
      return NextResponse.json({
        embedUrl: result.embedUrl,
        provider: result.provider,
        signed: result.signed,
        expiresInSeconds: result.expiresInSeconds,
        free: true,
      });
    } catch (error) {
      console.error("Free video embed URL error:", error);
      return NextResponse.json({ error: "تعذر إنشاء رابط الفيديو" }, { status: 500 });
    }
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Device lock: a revoked/removed device can't resolve a playback URL.
  if (session.role === "student" && session.deviceId) {
    const device = await prisma.device.findUnique({
      where: { userId_deviceId: { userId: session.id, deviceId: session.deviceId } },
    });
    if (!device) {
      return NextResponse.json(
        { error: "تم إلغاء تفعيل هذا الجهاز. يرجى تسجيل الدخول من جديد.", code: "DEVICE_REVOKED" },
        { status: 403 }
      );
    }
  }

  const token = req.nextUrl.searchParams.get("token");

  if (session.role === "student" && !token) {
    return NextResponse.json({ error: "يجب بدء جلسة مشاهدة أولاً" }, { status: 403 });
  }

  if (token) {
    const watchSession = await prisma.videoWatchSession.findUnique({
      where: { sessionToken: token },
    });

    if (!watchSession) {
      return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 });
    }
    if (watchSession.studentId !== session.id) {
      return NextResponse.json({ error: "غير مصرح بهذه الجلسة" }, { status: 403 });
    }
    if (watchSession.videoId !== id) {
      return NextResponse.json({ error: "الفيديو لا يتطابق مع الجلسة" }, { status: 400 });
    }
    if (watchSession.expiresAt < new Date()) {
      return NextResponse.json({ error: "انتهت جلسة المشاهدة" }, { status: 403 });
    }
  }

  const video = await prisma.video.findUnique({
    where: { id },
    include: { folder: { include: { course: { select: { id: true, teacherId: true } } } } },
  });

  if (!video) {
    return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
  }

  const hasAccess = await checkVideoAccess(session.id, session.role, id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "لا يوجد صلاحية للوصول. فعّل كود الكورس من صفحة الكورسات أولاً." },
      { status: 403 }
    );
  }

  // Scheduled unlock: students can't resolve a not-yet-published video.
  // Teachers/superadmin may preview scheduled content.
  if (session.role === "student" && isScheduledLocked(video.folder.publishAt, video.publishAt)) {
    return scheduledResponse(video.folder.publishAt, video.publishAt);
  }

  try {
    const domain = req.headers.get("x-forwarded-host") || req.headers.get("host") || undefined;
    const studentIdentifier = session.phone || session.name || session.id;
    const result = await resolveEmbedUrl(video, {
      userId: studentIdentifier,
      domain,
    });
    return NextResponse.json({
      embedUrl: result.embedUrl,
      provider: result.provider,
      signed: result.signed,
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (error) {
    console.error("Video embed URL error:", error);
    return NextResponse.json(
      { error: "تعذر إنشاء رابط فيديو آمن. تحقق من إعدادات مزود الفيديو." },
      { status: 500 }
    );
  }
}
