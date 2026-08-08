import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(id);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get("range");

    // Determine content type
    let contentType = "video/mp4";
    if (safeFilename.endsWith(".webm")) contentType = "video/webm";
    if (safeFilename.endsWith(".mov")) contentType = "video/quicktime";
    if (safeFilename.endsWith(".mkv")) contentType = "video/x-matroska";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const headers = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
        "Cache-Control": "no-store, private",
      });

      return new Response(fileStream as any, {
        status: 206,
        headers,
      });
    } else {
      const headers = new Headers({
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store, private",
      });

      const fileStream = fs.createReadStream(filePath);
      return new Response(fileStream as any, {
        status: 200,
        headers,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "فشل عرض الفيديو" }, { status: 500 });
  }
}
