import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAxinomDrmToken } from "@/lib/axinom";
import { prisma } from "@/lib/prisma";
import { decryptVdoCipherSecret, generateAccountOtp, selectBestAccountForUpload } from "@/lib/vdocipher-accounts";
import { timingSafeEqual } from "node:crypto";

const PREVIEW_PASSWORD = process.env.PREVIEW_PASSWORD || "codeup2030";
const PREVIEW_COOKIE_NAME = "codeup_preview_auth";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Teacher / CTO DRM Preview Endpoint:
 * Mints preview tokens / OTPs for testing newly packaged DRM assets (Axinom or VdoCipher)
 * before publishing them to course folders.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const cookie = req.cookies.get(PREVIEW_COOKIE_NAME)?.value;
    const isPreviewCookieValid = cookie ? safeCompare(cookie, PREVIEW_PASSWORD) : false;

    const isAuthorized =
      isPreviewCookieValid ||
      (session && (session.role === "teacher" || session.role === "admin" || session.role === "superadmin"));

    if (!isAuthorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      assetId?: string;
      title?: string;
      provider?: "axinom" | "vdocipher" | string;
      watermarkText?: string;
    };

    const assetId = (body.assetId || "").trim();
    if (!assetId) {
      return NextResponse.json({ error: "معرّف الفيديو (Asset ID / Video ID) مطلوب" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(assetId)) {
      return NextResponse.json({ error: "معرّف الفيديو يحتوي على أحرف غير صالحة" }, { status: 400 });
    }

    const studentIdentifier =
      session?.phone || session?.name || (session?.id ? `user_${session.id}` : "CTO_DRM_Preview");
    const watermark = body.watermarkText || studentIdentifier;
    const provider = body.provider === "vdocipher" ? "vdocipher" : "axinom";

    // ── 1. VdoCipher Provider Preview ─────────────────────────────────────────
    if (provider === "vdocipher") {
      let apiKey = "";
      let playerId: string | null = null;

      // Try locating the asset in database first to find the exact account
      const existingAsset = await prisma.vdoCipherVideoAsset.findFirst({
        where: { vdoCipherVideoId: assetId },
        include: { account: true },
      });

      if (existingAsset?.account?.apiKeyEnc) {
        try {
          apiKey = decryptVdoCipherSecret(existingAsset.account.apiKeyEnc);
          playerId = existingAsset.account.playerId;
        } catch (e) {
          console.error("[drm-preview] Failed to decrypt asset account key:", e);
        }
      }

      // If not linked to a specific asset record, select the best active VdoCipher account
      if (!apiKey) {
        const bestAccount = await selectBestAccountForUpload();
        if (bestAccount?.apiKey) {
          apiKey = bestAccount.apiKey;
          playerId = bestAccount.playerId;
        }
      }

      // If still no account, check for any active account in the database
      if (!apiKey) {
        const anyAccount = await prisma.vdoCipherAccount.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (anyAccount?.apiKeyEnc) {
          try {
            apiKey = decryptVdoCipherSecret(anyAccount.apiKeyEnc);
            playerId = anyAccount.playerId;
          } catch (e) {
            console.error("[drm-preview] Failed to decrypt fallback account key:", e);
          }
        }
      }

      // Fall back to environment variable if configured
      if (!apiKey && process.env.VDOCIPHER_API_SECRET) {
        apiKey = process.env.VDOCIPHER_API_SECRET;
      }

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "لا يوجد حساب VdoCipher نشط أو مفتاح API مهيأ في المنصة. يرجى إضافة حساب VdoCipher من لوحة التحكم العامة (Superadmin).",
          },
          { status: 400 }
        );
      }

      const OTP_TTL_SECONDS = 120;
      const vdoResult = await generateAccountOtp({
        apiKey,
        playerId,
        vdoCipherVideoId: assetId,
        userId: studentIdentifier,
        watermarkText: watermark,
        ttl: OTP_TTL_SECONDS,
      });

      return NextResponse.json({
        success: true,
        provider: "vdocipher",
        assetId,
        embedUrl: vdoResult.embedUrl,
        otp: vdoResult.otp,
        playbackInfo: vdoResult.playbackInfo,
        expiresInSeconds: OTP_TTL_SECONDS,
      });
    }

    // ── 2. Axinom DRM Provider Preview ────────────────────────────────────────
    // 2 hours expiration = 7200 seconds
    const EXPIRES_IN_SECONDS = 2 * 60 * 60;

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
      provider: "axinom",
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
