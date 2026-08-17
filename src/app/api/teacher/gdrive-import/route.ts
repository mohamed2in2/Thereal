import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractGoogleDriveFileId,
  getGoogleDriveFileMetadata,
  downloadGoogleDriveVideo,
} from "@/lib/google-drive";
import { getConfigNumber, getConfigNumberClamped } from "@/lib/config";
import { triggerPlanSyncForCourse } from "@/lib/plan-lesson-matcher";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      driveUrl?: string;
      title?: string;
      folderId?: string;
      durationMinutes?: number;
    };

    const rawUrl = body.url || body.driveUrl || "";
    const fileId = extractGoogleDriveFileId(rawUrl);

    if (!fileId) {
      return NextResponse.json(
        {
          error: "رابط Google Drive غير صحيح. يرجى إدخال رابط مشاركة صالح (مثال: https://drive.google.com/file/d/.../view) أو معرّف الملف.",
        },
        { status: 400 }
      );
    }

    // Step 1: Download from Google Drive into Native Security pipeline
    const downloadResult = await downloadGoogleDriveVideo(fileId);

    const videoTitle = (body.title || downloadResult.title || "درس فيديو جديد").trim();
    const durationMinutes =
      typeof body.durationMinutes === "number" && body.durationMinutes > 0
        ? body.durationMinutes
        : downloadResult.durationMinutes || 0;

    // Step 2: If folderId is provided, automatically create the Video record in Prisma
    let createdVideo: any = null;
    if (body.folderId) {
      const folderId = body.folderId;
      const folder = await prisma.folder.findFirst({
        where:
          session.role === "superadmin"
            ? { id: folderId }
            : { id: folderId, course: { teacherId: session.id } },
        include: { course: { select: { id: true } } },
      });

      if (!folder) {
        return NextResponse.json({ error: "المحاضرة غير موجودة أو لا تملك صلاحية إضافتها" }, { status: 404 });
      }

      const count = await prisma.video.count({ where: { folderId } });
      const maxPerFolder = await getConfigNumber("max_videos_per_folder");
      if (maxPerFolder > 0 && count >= maxPerFolder) {
        return NextResponse.json(
          { error: `لا يمكن إضافة أكثر من ${maxPerFolder} فيديو في المحاضرة الواحدة` },
          { status: 400 }
        );
      }

      const maxWatchesPerUser = await getConfigNumberClamped("default_max_watches", 1, 99);

      createdVideo = await prisma.video.create({
        data: {
          title: videoTitle,
          videoProvider: "alasly",
          providerVideoId: downloadResult.videoId,
          vdoCipherId: "",
          durationMinutes,
          maxWatchesPerUser,
          folderId,
          order: count,
        },
      });

      triggerPlanSyncForCourse(folder.course.id).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      isLocal: true,
      videoId: downloadResult.videoId,
      assetId: downloadResult.videoId,
      filename: downloadResult.filename,
      title: videoTitle,
      durationMinutes,
      sizeBytes: downloadResult.sizeBytes,
      videoProvider: "alasly",
      video: createdVideo,
      message: "تم استيراد وتحميل الفيديو من Google Drive وحمايته عبر Native Security بنجاح! 🚀",
    });
  } catch (error: any) {
    console.error("[Google Drive Import API] Error:", error.message || error);
    return NextResponse.json(
      {
        error: error.message || "حدث خطأ أثناء استيراد الفيديو من Google Drive",
      },
      { status: 500 }
    );
  }
}
