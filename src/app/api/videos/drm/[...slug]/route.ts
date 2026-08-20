import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoAccess } from "@/lib/authorization";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const DRM_STORAGE_DIR = path.resolve(process.cwd(), "uploads", "drm");

// Whitelist of allowed extensions for DRM media streaming
const ALLOWED_EXTENSIONS = new Set([".mpd", ".m3u8", ".m4s", ".mp4", ".ts"]);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Authorization, Content-Type, X-AxDRM-Message",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
    }

    // Strict path traversal prevention:
    // Reject any segment containing dot-dot, slashes, backslashes, or disallowed characters
    for (const segment of slug) {
      if (!segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\")) {
        return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(segment)) {
        return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
      }
    }

    const videoAssetId = slug[0];
    const subSegments = slug.slice(1);
    const subPath = subSegments.length > 0 ? subSegments.join(path.sep) : "manifest.mpd";

    // ── Authorization ──────────────────────────────────────────────────────────
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Video must exist in database — never fall open
    const video = await prisma.video.findFirst({
      where: {
        OR: [
          { providerVideoId: videoAssetId },
          { vdoCipherId: videoAssetId },
          { id: videoAssetId },
        ],
      },
      select: {
        id: true,
        isFree: true,
        folder: {
          select: {
            course: { select: { teacherId: true } },
          },
        },
      },
    });

    if (video) {
      const isOwner = session.role === "teacher" && video.folder?.course?.teacherId === session.id;
      const isStaff = session.role === "admin" || session.role === "superadmin" || isOwner;
      if (!video.isFree && !isStaff) {
        const hasAccess = await checkVideoAccess(session.id, session.role, video.id);
        if (!hasAccess) {
          return NextResponse.json({ error: "لا يوجد صلاحية للوصول لهذا المحتوى المحمي" }, { status: 403 });
        }
      }
    } else {
      // If video is newly uploaded and not yet saved in a lecture folder: only allow teacher/staff preview
      const isStaff = session.role === "teacher" || session.role === "admin" || session.role === "superadmin";
      if (!isStaff) {
        return NextResponse.json({ error: "المحتوى غير موجود" }, { status: 404 });
      }
    }


    // ── Canonical Path Resolution & Containment ────────────────────────────────
    const resolvedPath = path.resolve(DRM_STORAGE_DIR, videoAssetId, subPath);
    if (!resolvedPath.startsWith(DRM_STORAGE_DIR + path.sep)) {
      return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "نوع ملف غير مسموح" }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "الملف المشفر غير موجود" }, { status: 404 });
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
    }

    const fileSize = stat.size;

    // Determine Content-Type
    let contentType = "application/octet-stream";
    let isManifest = false;

    if (ext === ".mpd") {
      contentType = "application/dash+xml";
      isManifest = true;
    } else if (ext === ".m3u8") {
      contentType = "application/vnd.apple.mpegurl";
      isManifest = true;
    } else if (ext === ".m4s") {
      contentType = "video/iso.segment";
    } else if (ext === ".mp4") {
      contentType = "video/mp4";
    } else if (ext === ".ts") {
      contentType = "video/mp2t";
    }

    const baseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Authorization, Content-Type, X-AxDRM-Message",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Cache-Control": isManifest
        ? "no-cache, no-store, must-revalidate"
        : "public, max-age=31536000, immutable",
    };

    // ── Range Request Handling (HTTP 206) with suffix range support ────────────
    const range = req.headers.get("range");
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      let start: number;
      let end: number;

      if (parts[0] === "") {
        // Suffix range: e.g. bytes=-500 (last 500 bytes of the file)
        const suffixLength = Number.parseInt(parts[1], 10);
        if (Number.isNaN(suffixLength) || suffixLength <= 0) {
          return new Response(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileSize}`,
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = Number.parseInt(parts[0], 10);
        const requestedEnd = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
        end = Math.min(Number.isNaN(requestedEnd) ? fileSize - 1 : requestedEnd, fileSize - 1);
      }

      if (Number.isNaN(start) || start < 0 || start > end || start >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(resolvedPath, { start, end });

      return new Response(fileStream as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
        },
      });
    }

    // Full file response (HTTP 200)
    const fileStream = fs.createReadStream(resolvedPath);
    return new Response(fileStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("[videos/drm] stream error:", error);
    return NextResponse.json({ error: "فشل بث المحتوى المحمي" }, { status: 500 });
  }
}
