import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initAlaslyUpload, completeAlaslyUpload } from "@/lib/alasly";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // A. Direct Binary Stream Upload (fastest, lowest memory, smooth progress)
    if (contentType.includes("application/octet-stream") || contentType.startsWith("video/") || contentType.includes("multipart/form-data")) {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      let originalName = req.headers.get("x-filename") || "video.mp4";
      try {
        originalName = decodeURIComponent(originalName);
      } catch {
        // use fallback if not URI encoded
      }

      const ext = path.extname(originalName) || ".mp4";
      const randomId = crypto.randomBytes(8).toString("hex");
      const filename = `local_${Date.now()}_${randomId}${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          return NextResponse.json({ error: "لم يتم اختيار أي ملف للرفع" }, { status: 400 });
        }
        const arrayBuffer = await file.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      } else {
        // Stream directly from req.body to disk
        if (!req.body) {
          return NextResponse.json({ error: "محتوى الملف فارغ" }, { status: 400 });
        }
        const nodeStream = Readable.fromWeb(req.body as any);
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(nodeStream, writeStream);
      }

      return NextResponse.json({
        success: true,
        isLocal: true,
        videoId: filename,
        assetId: filename,
        status: "ready",
      });
    }

    // B. JSON payload (init / complete)
    const body = await req.json();
    const action = body.action || "init";

    if (action === "init") {
      const title = body.title || body.filename || "درس جديد";
      const external_ref = body.external_ref || body.lesson_id || `lesson_${Date.now()}`;
      const playback_kind = body.playback_kind || "mp4";
      const filename = body.filename || "video.mp4";
      const fileContentType = body.contentType || "video/mp4";
      const size = Number(body.size) || 0;

      try {
        const result = await initAlaslyUpload({
          title,
          external_ref,
          playback_kind,
          filename,
          contentType: fileContentType,
          size,
        });
        return NextResponse.json({ success: true, isLocal: false, ...result });
      } catch (err: any) {
        console.warn("[Native Upload] Cloud SaaS init failed, using local server upload fallback:", err.message);
        return NextResponse.json({
          success: true,
          isLocal: true,
          uploadUrl: "/api/teacher/native-upload",
          assetId: "local_upload",
        });
      }
    }

    if (action === "complete") {
      const assetId = body.assetId || body.asset_id;
      if (!assetId) {
        return NextResponse.json({ error: "assetId مطلوب لإتمام الرفع" }, { status: 400 });
      }

      if (assetId.startsWith("local_")) {
        return NextResponse.json({ success: true, isLocal: true, videoId: assetId, assetId, status: "ready" });
      }

      const duration = typeof body.duration === "number" ? body.duration : undefined;
      const size_bytes =
        typeof body.size_bytes === "number"
          ? body.size_bytes
          : typeof body.size === "number"
          ? body.size
          : undefined;

      try {
        const result = await completeAlaslyUpload({
          assetId,
          duration,
          size_bytes,
        });
        return NextResponse.json({ success: true, isLocal: false, ...result });
      } catch (err: any) {
        return NextResponse.json({ success: true, isLocal: true, videoId: assetId, assetId, status: "ready" });
      }
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "فشل الاتصال بخدمة Native Video" }, { status: 500 });
  }
}
