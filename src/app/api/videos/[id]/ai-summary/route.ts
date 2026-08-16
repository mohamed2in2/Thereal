import { NextRequest, NextResponse } from "next/server";
import { getSession, getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLectureSummary } from "@/lib/ai-lecture-summary";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = (await getStudentSession()) ?? (await getSession());
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
    }

    const { id: videoId } = await context.params;
    if (!videoId) {
      return NextResponse.json({ error: "معرف الفيديو مطلوب" }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        folder: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                subject: true,
                educationalStage: true,
              },
            },
          },
        },
        questions: {
          select: {
            questionText: true,
            correctOption: true,
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

    const summary = await generateLectureSummary(
      {
        videoId: video.id,
        title: video.title,
        courseTitle: video.folder?.course?.title,
        subject: video.folder?.course?.subject,
        educationalStage: video.folder?.course?.educationalStage,
        folderName: video.folder?.name,
        durationMinutes: video.durationMinutes,
        questions: video.questions.map((q) => ({
          question: q.questionText,
          correctAnswer: q.correctOption,
        })),
      },
      forceRefresh
    );

    return NextResponse.json({
      success: true,
      videoId: video.id,
      title: video.title,
      courseTitle: video.folder?.course?.title,
      durationMinutes: video.durationMinutes,
      summary,
    });
  } catch (error) {
    console.error("[ai-summary] error:", error);
    return NextResponse.json({ error: "تعذر توليد ملخص المحاضرة" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return GET(req, context);
}
