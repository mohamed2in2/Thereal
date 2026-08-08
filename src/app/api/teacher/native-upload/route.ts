import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initAlaslyUpload, completeAlaslyUpload } from "@/lib/alasly";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // A. Direct File Upload via FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "لم يتم اختيار أي ملف للرفع" }, { status: 400 });
      }

      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      const ext = path.extname(file.name) || ".mp4";
      const randomId = crypto.randomBytes(8).toString("hex");
      const filename = `local_${Date.now()}_${randomId}${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

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
      const filename = body.filename || "video.mp4";
      const fileContentType = body.contentType || "video/mp4";
      const size = Number(body.size) || 0;

      try {
        const result = await initAlaslyUpload(filename, fileContentType, size);
        return NextResponse.json({ success: true, isLocal: false, ...result });
      } catch (err: any) {
        // Fallback to direct local server upload if cloud SaaS init fails
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

      try {
        const result = await completeAlaslyUpload(assetId);
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
