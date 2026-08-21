import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfigNumber, getConfigNumberClamped } from "@/lib/config";
import { parsePublishAt } from "@/lib/publish";
import {
  selectBestAccountForUpload,
  requestVdoCipherUploadTicket,
} from "@/lib/vdocipher-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      folderId?: string;
      durationMinutes?: number;
      maxWatchesPerUser?: number;
      publishAt?: string | null;
      estimatedSizeBytes?: number;
    };

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "عنوان الفيديو مطلوب" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: "عنوان الفيديو لا يمكن أن يزيد عن 100 حرف" }, { status: 400 });
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
      include: { course: { select: { id: true, teacherId: true } } },
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

    // Select the best VdoCipher account automatically
    const bestAccount = await selectBestAccountForUpload({
      estimatedSizeBytes: body.estimatedSizeBytes,
    });

    if (!bestAccount) {
      return NextResponse.json(
        {
          error:
            "لا توجد حسابات VdoCipher نشطة تملك سعة كافية للرفع حالياً. يرجى التواصل مع المشرف العام.",
        },
        { status: 503 }
      );
    }

    // Request S3 upload ticket from VdoCipher
    const ticket = await requestVdoCipherUploadTicket({
      apiKey: bestAccount.apiKey,
      title,
    });

    const durationMinutes =
      typeof body.durationMinutes === "number" && body.durationMinutes >= 0
        ? Math.floor(body.durationMinutes)
        : 0;

    const maxWatchesPerUser =
      typeof body.maxWatchesPerUser === "number" && body.maxWatchesPerUser >= 1
        ? Math.floor(body.maxWatchesPerUser)
        : await getConfigNumberClamped("default_max_watches", 1, 99);

    const publishAt = parsePublishAt(body.publishAt) ?? null;

    // Create the video record in platform database
    const video = await prisma.video.create({
      data: {
        title,
        videoProvider: "vdocipher",
        providerVideoId: ticket.videoId,
        vdoCipherId: ticket.videoId,
        durationMinutes,
        maxWatchesPerUser,
        publishAt,
        folderId,
        order: count,
      },
    });

    // Create the multi-account asset instance
    await prisma.vdoCipherVideoAsset.create({
      data: {
        videoId: video.id,
        accountId: bestAccount.id,
        vdoCipherVideoId: ticket.videoId,
        status: "uploading",
        durationSeconds: durationMinutes * 60,
        sizeBytes: BigInt(body.estimatedSizeBytes || 0),
      },
    });

    return NextResponse.json({
      success: true,
      videoId: video.id,
      providerVideoId: ticket.videoId,
      uploadLink: ticket.uploadLink,
      clientPayload: ticket.clientPayload,
      title: video.title,
    });
  } catch (error: any) {
    console.error("[Teacher VdoCipher Upload Ticket] Error:", error.message || error);
    return NextResponse.json(
      { error: error.message || "تعذر بدء عملية رفع الفيديو" },
      { status: 500 }
    );
  }
}
