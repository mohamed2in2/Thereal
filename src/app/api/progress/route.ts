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
        console.error("[progress] error:", error);
        return NextResponse.json(
          { error: "حدث خطأ داخلي" },
          { status: 500 }
        );
      }
}

export async function POST(req: NextRequest) {

      try {
      const session = await getStudentSession();
      if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

      const { videoId, watched = true } = await req.json();
      if (!videoId) return NextResponse.json({ error: "videoId مطلوب" }, { status: 400 });

      const hasAccess = await checkVideoAccess(session.id, session.role, videoId);
      if (!hasAccess) return NextResponse.json({ error: "لا يوجد صلاحية للوصول" }, { status: 403 });

      const progress = await prisma.progress.upsert({
        where: { studentId_videoId: { studentId: session.id, videoId } },
        update: { watched, watchedAt: watched ? new Date() : null },
        create: { studentId: session.id, videoId, watched, watchedAt: watched ? new Date() : null },
      });

      return NextResponse.json({ progress });
    } catch (error) {
        console.error("[progress] error:", error);
        return NextResponse.json(
          { error: "حدث خطأ داخلي" },
          { status: 500 }
        );
      }
}
