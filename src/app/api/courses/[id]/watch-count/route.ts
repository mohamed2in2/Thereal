import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, maxWatchCount: true },
  });

  if (!course) return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });

  const usedWatchCount = await prisma.videoWatchSession.count({
    where: {
      studentId: session.id,
      usedWatchSlot: true,
      video: { folder: { courseId } },
    },
  });

  return NextResponse.json({
    courseId,
    maxWatchCount: course.maxWatchCount,
    usedWatches: usedWatchCount,
    remainingWatches: Math.max(0, course.maxWatchCount - usedWatchCount),
  });
}
