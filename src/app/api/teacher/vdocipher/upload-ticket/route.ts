import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfigNumber, getConfigNumberClamped } from "@/lib/config";
import { parsePublishAt } from "@/lib/publish";
import {
  selectBestAccountForUpload,
  requestVdoCipherUploadTicket,
  decryptVdoCipherSecret,
} from "@/lib/vdocipher-accounts";
import { isAuthorizedStaffUpload } from "@/lib/preview-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!isAuthorizedStaffUpload(session)) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول. يتطلب رفع الفيديوهات تسجيل الدخول كمعلم أو مسؤول." },
        { status: 403 }
      );
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

    // Select the best VdoCipher account automatically with multi-level fallback
    const bestAccount = await selectBestAccountForUpload({
      estimatedSizeBytes: body.estimatedSizeBytes,
    });

    let apiKey = bestAccount?.apiKey || "";
    let accountId = bestAccount?.id || "";

    if (!apiKey) {
      const anyActive = await prisma.vdoCipherAccount.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (anyActive?.apiKeyEnc) {
        try {
          apiKey = decryptVdoCipherSecret(anyActive.apiKeyEnc);
          accountId = anyActive.id;
        } catch (e) {
          console.error("[upload-ticket] Fallback decrypt error:", e);
        }
      }
    }

    if (!apiKey && process.env.VDOCIPHER_API_SECRET) {
      apiKey = process.env.VDOCIPHER_API_SECRET;
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "لا توجد حسابات VdoCipher نشطة أو مفاتيح API مهيأة في المنصة. يرجى إضافة حساب من لوحة التحكم العامة (Superadmin).",
        },
        { status: 503 }
      );
    }

    // Request S3 upload ticket from VdoCipher
    const ticket = await requestVdoCipherUploadTicket({
      apiKey,
      title,
    });

    const folderId = body.folderId;

    // ── Standalone Preview Upload (without folderId) ──────────────────────────
    if (!folderId) {
      return NextResponse.json({
        success: true,
        isPreview: true,
        providerVideoId: ticket.videoId,
        videoId: ticket.videoId,
        uploadLink: ticket.uploadLink,
        clientPayload: ticket.clientPayload,
        title,
      });
    }

    // ── Course Lecture Upload (with folderId) ─────────────────────────────────
    if (!session || !["teacher", "admin", "superadmin"].includes(session.role || "")) {
      return NextResponse.json(
        { error: "تسجيل الدخول كمعلم أو مشرف مطلوب لإضافة فيديو لمحاضرة" },
        { status: 403 }
      );
    }

    const folder = await prisma.folder.findFirst({
      where:
        session.role === "superadmin" || session.role === "admin"
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
    if (accountId) {
      await prisma.vdoCipherVideoAsset.create({
        data: {
          videoId: video.id,
          accountId,
          vdoCipherVideoId: ticket.videoId,
          status: "uploading",
          durationSeconds: durationMinutes * 60,
          sizeBytes: BigInt(body.estimatedSizeBytes || 0),
        },
      });
    }

    return NextResponse.json({
      success: true,
      videoId: video.id,
      providerVideoId: ticket.videoId,
      uploadLink: ticket.uploadLink,
      clientPayload: ticket.clientPayload,
      title: video.title,
    });
  } catch (error: unknown) {
    const errMsg = (error as Error)?.message || String(error);
    console.error("[Teacher VdoCipher Upload Ticket] Error:", errMsg);
    return NextResponse.json(
      { error: "تعذر بدء عملية رفع الفيديو إلى VdoCipher" },
      { status: 500 }
    );
  }
}
