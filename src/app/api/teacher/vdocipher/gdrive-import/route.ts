import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractGoogleDriveFileId,
  getGoogleDriveFileMetadata,
  getGoogleDriveAccessToken,
} from "@/lib/google-drive";
import { getConfigNumber, getConfigNumberClamped } from "@/lib/config";
import { triggerPlanSyncForCourse } from "@/lib/plan-lesson-matcher";
import {
  selectBestAccountForUpload,
  requestVdoCipherUploadTicket,
} from "@/lib/vdocipher-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول. هذه الميزة مخصصة لحسابات المعلمين والإدارة." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      driveUrl?: string;
      title?: string;
      folderId?: string;
      durationMinutes?: number;
      maxWatchesPerUser?: number;
      publishAt?: string | null;
    };

    const rawUrl = body.url || body.driveUrl || "";
    const fileId = extractGoogleDriveFileId(rawUrl);

    if (!fileId) {
      return NextResponse.json(
        {
          error:
            "رابط Google Drive غير صحيح. يرجى إدخال رابط مشاركة صالح (مثال: https://drive.google.com/file/d/.../view) أو معرّف الملف.",
        },
        { status: 400 }
      );
    }

    const folderId = body.folderId;
    if (!folderId) {
      return NextResponse.json({ error: "معرف المحاضرة مطلوب" }, { status: 400 });
    }

    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
      where:
        session.role === "superadmin"
          ? { id: folderId }
          : { id: folderId, course: { teacherId: session.id } },
      include: { course: { select: { id: true } } },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "المحاضرة غير موجودة أو لا تملك صلاحية إضافتها" },
        { status: 404 }
      );
    }

    const count = await prisma.video.count({ where: { folderId } });
    const maxPerFolder = await getConfigNumber("max_videos_per_folder");
    if (maxPerFolder > 0 && count >= maxPerFolder) {
      return NextResponse.json(
        { error: `لا يمكن إضافة أكثر من ${maxPerFolder} فيديو في المحاضرة الواحدة` },
        { status: 400 }
      );
    }

    // 1. Fetch file metadata from Google Drive
    const metadata = await getGoogleDriveFileMetadata(fileId);
    const videoTitle = (body.title || metadata.name || "درس فيديو جديد").trim();
    const sizeBytes = Number(metadata.size) || 0;

    let durationMinutes = body.durationMinutes || 0;
    if (!durationMinutes && metadata.videoMediaMetadata?.durationMillis) {
      durationMinutes = Math.round(Number(metadata.videoMediaMetadata.durationMillis) / 60000);
    }

    // 2. Select best VdoCipher account automatically
    const bestAccount = await selectBestAccountForUpload({
      estimatedSizeBytes: sizeBytes,
    });

    if (!bestAccount) {
      return NextResponse.json(
        {
          error:
            "لا توجد حسابات VdoCipher نشطة تملك سعة كافية للرفع حالياً. يرجى مراجعة إدارة المنصة.",
        },
        { status: 503 }
      );
    }

    // 3. Request upload ticket from VdoCipher
    const ticket = await requestVdoCipherUploadTicket({
      apiKey: bestAccount.apiKey,
      title: videoTitle,
    });

    // 4. Stream video directly from Google Drive to VdoCipher S3
    const token = await getGoogleDriveAccessToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

    const gdriveRes = await fetch(downloadUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!gdriveRes.ok || !gdriveRes.body) {
      throw new Error(`فشل تنزيل الفيديو من Google Drive (${gdriveRes.status})`);
    }

    // Convert download stream to buffer / blob for S3 form-data POST
    const arrayBuffer = await gdriveRes.arrayBuffer();
    const videoBlob = new Blob([arrayBuffer], {
      type: metadata.mimeType || "video/mp4",
    });

    const formData = new FormData();
    const payload = ticket.clientPayload;
    for (const key of Object.keys(payload)) {
      if (key !== "uploadLink") {
        formData.append(key, payload[key]);
      }
    }
    formData.append("file", videoBlob, metadata.name || "video.mp4");

    const s3Res = await fetch(ticket.uploadLink, {
      method: "POST",
      body: formData,
    });

    if (!s3Res.ok && s3Res.status !== 201 && s3Res.status !== 204) {
      const s3ErrorText = await s3Res.text();
      console.error("[VdoCipher S3 Upload Error]:", s3ErrorText);
      throw new Error(`تعذر إتمام رفع الفيديو إلى VdoCipher (${s3Res.status})`);
    }

    // 5. Create Video & VdoCipherVideoAsset records
    const maxWatchesPerUser =
      typeof body.maxWatchesPerUser === "number" && body.maxWatchesPerUser >= 1
        ? Math.floor(body.maxWatchesPerUser)
        : await getConfigNumberClamped("default_max_watches", 1, 99);

    const createdVideo = await prisma.video.create({
      data: {
        title: videoTitle,
        videoProvider: "vdocipher",
        providerVideoId: ticket.videoId,
        vdoCipherId: ticket.videoId,
        durationMinutes,
        maxWatchesPerUser,
        folderId,
        order: count,
      },
    });

    await prisma.vdoCipherVideoAsset.create({
      data: {
        videoId: createdVideo.id,
        accountId: bestAccount.id,
        vdoCipherVideoId: ticket.videoId,
        status: "ready",
        durationSeconds: durationMinutes * 60,
        sizeBytes: BigInt(sizeBytes),
      },
    });

    // Fire auto-matcher sync
    triggerPlanSyncForCourse(folder.course.id).catch(console.error);

    const sizeFormatted =
      sizeBytes >= 1024 * 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} جيجابايت`
        : `${(sizeBytes / (1024 * 1024)).toFixed(1)} ميجابايت`;

    return NextResponse.json({
      success: true,
      videoId: createdVideo.id,
      providerVideoId: ticket.videoId,
      title: videoTitle,
      durationMinutes,
      sizeFormatted,
      video: createdVideo,
      message: `تم استيراد الفيديو بنجاح (${sizeFormatted}) وتعيينه في VdoCipher بحماية كاملة! 🚀`,
    });
  } catch (error: any) {
    console.error("[VdoCipher Google Drive Import] Error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء استيراد الفيديو من Google Drive" },
      { status: 500 }
    );
  }
}
