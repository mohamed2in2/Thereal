import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoAccess } from "@/lib/authorization";

export async function GET() {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const codes = await prisma.accessCode.findMany({
      where: { studentId: session.id },
      include: {
        course: {
          include: {
            teacher: { select: { id: true, name: true } },
            folders: {
              include: {
                videos: true,
                quizzes: true,
              },
            },
            _count: { select: { folders: true } },
          },
        },
      },
    });

    const quizResults = await prisma.quizResult.findMany({
      where: { studentId: session.id },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            folder: {
              select: {
                name: true,
                course: { select: { id: true, title: true, subject: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ courses: codes.map((c) => c.course), quizResults });
  } catch (error) {
    console.error("[progress] GET error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { videoId, watched } = body as { videoId?: unknown; watched?: unknown };

    if (!videoId || typeof videoId !== "string" || videoId.trim().length === 0) {
      return NextResponse.json({ error: "videoId مطلوب" }, { status: 400 });
    }

    // watched must be a strict boolean — anything else defaults to true
    const safeWatched = typeof watched === "boolean" ? watched : true;

    const hasAccess = await checkVideoAccess(session.id, session.role, videoId.trim());
    if (!hasAccess) {
      return NextResponse.json({ error: "لا يوجد صلاحية للوصول" }, { status: 403 });
    }

    const progress = await prisma.progress.upsert({
      where: { studentId_videoId: { studentId: session.id, videoId: videoId.trim() } },
      update: { watched: safeWatched, watchedAt: safeWatched ? new Date() : null },
      create: {
        studentId: session.id,
        videoId: videoId.trim(),
        watched: safeWatched,
        watchedAt: safeWatched ? new Date() : null,
      },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("[progress] POST error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
