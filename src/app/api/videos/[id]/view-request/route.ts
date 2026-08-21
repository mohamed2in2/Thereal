import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoAccess } from "@/lib/authorization";
import { getGrantedViews } from "@/lib/watch-allowance";
import { notifyViewRequestSubmitted } from "@/lib/notifications";

const MAX_REASON_LENGTH = 500;
/** A student who has been refused this many times stops being able to re-ask. */
const MAX_REJECTED_REQUESTS = 3;

/** Current request state for this student + video, used to drive the UI. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id: videoId } = await params;

  const [pending, granted, rejectedCount] = await Promise.all([
    prisma.videoViewRequest.findFirst({
      where: { studentId: session.id, videoId, status: "pending" },
      select: { id: true, createdAt: true, reason: true },
    }),
    getGrantedViews(prisma, session.id, videoId),
    prisma.videoViewRequest.count({
      where: { studentId: session.id, videoId, status: "rejected" },
    }),
  ]);

  return NextResponse.json({
    pending: pending ? { id: pending.id, createdAt: pending.createdAt, reason: pending.reason } : null,
    grantedViews: granted,
    canRequest: !pending && rejectedCount < MAX_REJECTED_REQUESTS,
  });
}

/** Student asks for extra views after exhausting the per-video limit. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  // Staff never consume watch slots, so they have nothing to request.
  if (session.role !== "student") {
    return NextResponse.json({ error: "هذا الإجراء متاح للطلاب فقط" }, { status: 403 });
  }

  const { id: videoId } = await params;

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : "";

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      maxWatchesPerUser: true,
      isFree: true,
      folder: { select: { course: { select: { id: true, teacherId: true } } } },
    },
  });
  if (!video) {
    return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
  }

  // Requesting more views only makes sense for content the student may watch;
  // without this any logged-in user could queue requests for every video.
  const hasAccess = await checkVideoAccess(session.id, session.role, videoId);
  if (!hasAccess && !video.isFree) {
    return NextResponse.json({ error: "لا يوجد صلاحية للوصول لهذا المحتوى" }, { status: 403 });
  }

  const rejectedCount = await prisma.videoViewRequest.count({
    where: { studentId: session.id, videoId, status: "rejected" },
  });
  if (rejectedCount >= MAX_REJECTED_REQUESTS) {
    return NextResponse.json(
      { error: "تم رفض طلباتك السابقة لهذا الدرس. تواصل مع المعلم مباشرة.", code: "TOO_MANY_REJECTIONS" },
      { status: 429 }
    );
  }

  // Only ask when the allowance is actually spent, otherwise the teacher's queue
  // fills with requests from students who still have views left.
  const [usedCount, granted] = await Promise.all([
    prisma.videoWatchSession.count({
      where: { studentId: session.id, videoId, usedWatchSlot: true },
    }),
    getGrantedViews(prisma, session.id, videoId),
  ]);
  if (usedCount < video.maxWatchesPerUser + granted) {
    return NextResponse.json(
      { error: "لا يزال لديك مشاهدات متبقية لهذا الدرس", code: "WATCHES_REMAINING" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.videoViewRequest.create({
      data: { studentId: session.id, videoId, reason: reason || null, status: "pending" },
      select: { id: true, createdAt: true },
    });

    if (video.folder?.course?.teacherId) {
      notifyViewRequestSubmitted(
        video.folder.course.teacherId,
        session.name || "طالب",
        video.title
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (e) {
    // Partial unique index on (studentId, videoId) WHERE status = 'pending'
    // rejects a second open request, including two submitted in parallel.
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "لديك طلب قيد المراجعة بالفعل", code: "ALREADY_PENDING" },
        { status: 409 }
      );
    }
    console.error("view-request create failed:", e);
    return NextResponse.json({ error: "تعذر إرسال الطلب" }, { status: 500 });
  }
}
