import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAxinomDrmToken } from "@/lib/axinom";

/**
 * Teacher DRM Preview Endpoint:
 * Mints a 2-hour preview token for testing newly packaged DRM assets before publishing them to course folders.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      assetId?: string;
      title?: string;
    };

    const assetId = (body.assetId || "").trim();
    if (!assetId) {
      return NextResponse.json({ error: "معرّف الفيديو (Asset ID) مطلوب" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(assetId)) {
      return NextResponse.json({ error: "معرّف الفيديو يحتوي على أحرف غير صالحة" }, { status: 400 });
    }

    // 2 hours expiration = 7200 seconds
    const EXPIRES_IN_SECONDS = 2 * 60 * 60;
    const studentIdentifier = session.phone || session.name || `teacher_${session.id}`;

    const drmResult = createAxinomDrmToken({
      videoId: assetId,
      userId: studentIdentifier,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = host ? `${proto}://${host}` : "";

    const previewUrl = `${origin}/preview/drm?assetId=${encodeURIComponent(assetId)}&token=${encodeURIComponent(drmResult.token)}&title=${encodeURIComponent(body.title || "معاينة درس مشفر")}&exp=${encodeURIComponent(drmResult.expiresAt)}`;

    return NextResponse.json({
      success: true,
      assetId,
      previewUrl,
      manifestUrl: drmResult.manifestUrl,
      drm: {
        token: drmResult.token,
        licenseServers: drmResult.licenseServers,
      },
      expiresAt: drmResult.expiresAt,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });
  } catch (error: any) {
    console.error("[teacher/drm-preview] error:", error);
    return NextResponse.json({ error: error.message || "تعذر إنشاء جلسة المعاينة" }, { status: 500 });
  }
}
