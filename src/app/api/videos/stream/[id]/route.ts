import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoAccess } from "@/lib/authorization";
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

    // ── Authorization ────────────────────────────────────────────────────────
    // The path segment is a *provider asset id*, not a Video row id, so resolve
    // the owning lesson first. Without this, any logged-in account could stream
    // any uploaded lesson simply by naming its file — enrollment, purchase and
    // plan gating were all bypassed for locally hosted video.
    const video = await prisma.video.findFirst({
      where: { OR: [{ providerVideoId: safeFilename }, { vdoCipherId: safeFilename }] },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const hasAccess = await checkVideoAccess(session.id, session.role, video.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "لا يوجد صلاحية للوصول لهذا الفيديو" }, { status: 403 });
    }

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
      // A malformed or out-of-bounds Range must not produce a negative-length
      // read; clamp to the file and reject anything still nonsensical.
      const start = Number.parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
      const end = Math.min(Number.isNaN(requestedEnd) ? fileSize - 1 : requestedEnd, fileSize - 1);

      if (Number.isNaN(start) || start < 0 || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const headers = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
        "Cache-Control": "no-store, private",
      });

      // Node's ReadStream is accepted by undici at runtime but isn't typed as a
      // web ReadableStream; the double cast is the impedance mismatch, not a
      // suppressed type error.
      return new Response(fileStream as unknown as ReadableStream, {
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
      // Node's ReadStream is accepted by undici at runtime but isn't typed as a
      // web ReadableStream; the double cast is the impedance mismatch, not a
      // suppressed type error.
      return new Response(fileStream as unknown as ReadableStream, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    // Never surface raw error text (it leaks absolute filesystem paths).
    console.error("[videos/stream] error:", error);
    return NextResponse.json({ error: "فشل عرض الفيديو" }, { status: 500 });
  }
}
