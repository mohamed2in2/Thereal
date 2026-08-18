import crypto from "node:crypto";

/**
 * Alasly Video Service — API Client
 * Secure REST API video transcoding & streaming integration.
 * Endpoint: /functions/v1/video-service/v1
 * Authentication: API Key + HMAC-SHA256 signature with 5-minute validity window.
 */

const DEFAULT_BASE_URL = "https://rkmsjkcnpmqpiugcsvld.supabase.co/functions/v1/video-service/v1";

export function getAlaslyBaseUrl(): string {
  return (
    process.env.VIDEO_API_BASE_URL ||
    process.env.ALASLY_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

/**
 * Reads Alasly Video API credentials from environment.
 */
export function getAlaslyCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = (process.env.VIDEO_API_KEY || process.env.ALASLY_API_KEY || "").trim();
  const apiSecret = (process.env.VIDEO_API_SECRET || process.env.ALASLY_API_SECRET || "").trim();

  if (!apiKey || !apiSecret) {
    throw new Error(
      "VIDEO_API_KEY / VIDEO_API_SECRET are not configured — refusing to resolve Alasly video service."
    );
  }

  return { apiKey, apiSecret };
}

/**
 * Core authenticated API call function.
 * Signs each request using HMAC-SHA256 with format: {timestamp}.{METHOD}.{route}.{rawBody}
 */
export async function callVideoApi<T = any>(
  route: string,
  body: Record<string, any> | null = null,
  method = "POST"
): Promise<T> {
  const { apiKey, apiSecret } = getAlaslyCredentials();
  const base = getAlaslyBaseUrl();

  const formattedRoute = route.startsWith("/") ? route : `/${route}`;
  const raw = body ? JSON.stringify(body) : "";
  const ts = Date.now().toString();

  const hmacPayload = `${ts}.${method.toUpperCase()}.${formattedRoute}.${raw}`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(hmacPayload)
    .digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-timestamp": ts,
    "x-signature": signature,
  };

  const res = await fetch(base + formattedRoute, {
    method,
    headers,
    body: method.toUpperCase() === "GET" ? undefined : raw,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`[${res.status}] ${errorText || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Video Playback
// ─────────────────────────────────────────────────────────────────────────────

export interface AlaslyPlaybackResult {
  token: string;
  playbackUrl: string;
  embedUrl: string;
  iframe?: string;
  iframeHtml?: string;
  expiresIn: number;
  expiresInSeconds: number;
  expiresAt: string;
  title?: string;
}

export interface AlaslyPlaybackParams {
  videoId: string;
  userId?: string;
  domain?: string;
}

/**
 * Mint a short-lived (120s) playback token for a student on a specific domain.
 * Dynamic watermarking uses the provided userId (or student identifier).
 */
export async function getAlaslyPlaybackToken(
  paramsOrLessonId: AlaslyPlaybackParams | string,
  domainFallback?: string
): Promise<AlaslyPlaybackResult> {
  const params: AlaslyPlaybackParams =
    typeof paramsOrLessonId === "string"
      ? { videoId: paramsOrLessonId, domain: domainFallback }
      : paramsOrLessonId;

  const { videoId } = params;
  if (!videoId) {
    throw new Error("Alasly Video ID is required");
  }

  // Handle local video server streaming and Google Drive direct stream proxying
  if (
    videoId.startsWith("local_") ||
    videoId.startsWith("gdrive_") ||
    videoId.endsWith(".mp4") ||
    videoId.endsWith(".webm") ||
    videoId.endsWith(".mov")
  ) {
    return {
      token: "local",
      playbackUrl: `/api/videos/stream/${encodeURIComponent(videoId)}`,
      embedUrl: `/api/videos/stream/${encodeURIComponent(videoId)}`,
      expiresIn: 86400,
      expiresInSeconds: 86400,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      title: "Local Video",
    };
  }

  const currentDomain =
    params.domain ||
    (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : "localhost:3000");

  const payload: Record<string, any> = {
    videoId,
    domain: currentDomain,
  };
  if (params.userId) {
    payload.userId = params.userId;
  }

  try {
    const play = await callVideoApi<any>("/playback/token", payload, "POST");

    const token = play.token || play.playback_token || "";
    const playbackUrl = play.playbackUrl || play.playback_url || play.embed_url || "";
    const expiresIn = Number(play.expiresIn || play.expires_in) || 120;

    let embedUrl = playbackUrl;
    if (!embedUrl && token) {
      embedUrl = `https://alasly.lovable.app/embed/lesson/${encodeURIComponent(videoId)}?key=${encodeURIComponent(token)}`;
    }

    return {
      token,
      playbackUrl: embedUrl,
      embedUrl,
      iframe: play.iframe,
      iframeHtml: play.iframe,
      expiresIn,
      expiresInSeconds: expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      title: play.title,
    };
  } catch (error: any) {
    console.error("[Alasly Video] Failed to obtain playback token for video %s:", videoId, error.message);
    throw new Error("تعذر تشغيل الفيديو المحمي، يرجى المحاولة مرة أخرى لاحقاً.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Video Upload
// ─────────────────────────────────────────────────────────────────────────────

export interface AlaslyUploadInitParams {
  title: string;
  external_ref?: string;
  playback_kind?: "mp4" | "hls";
  filename?: string;
  contentType?: string;
  size?: number;
}

export interface AlaslyUploadInitResult {
  assetId: string;
  uploadUrl: string;
  path?: string;
  expiresIn?: number;
  expiresInSeconds?: number;
}

export interface AlaslyUploadCompleteParams {
  assetId: string;
  duration?: number;
  size_bytes?: number;
}

export interface AlaslyUploadCompleteResult {
  videoId: string;
  assetId: string;
  status: "ready" | "processing" | string;
  duration?: number;
}

/**
 * Step 1 of Upload: Initialize upload and get Presigned uploadUrl.
 */
export async function initAlaslyUpload(
  paramsOrTitle: AlaslyUploadInitParams | string,
  contentTypeFallback?: string,
  fileSizeFallback?: number
): Promise<AlaslyUploadInitResult> {
  let payload: Record<string, any>;

  if (typeof paramsOrTitle === "string") {
    payload = {
      title: paramsOrTitle || "درس جديد",
      external_ref: `upload_${Date.now()}`,
      playback_kind: "mp4",
    };
  } else {
    payload = {
      title: paramsOrTitle.title || paramsOrTitle.filename || "درس جديد",
      external_ref: paramsOrTitle.external_ref || `upload_${Date.now()}`,
      playback_kind: paramsOrTitle.playback_kind || "mp4",
    };
  }

  const res = await callVideoApi<any>("/upload/init", payload, "POST");

  const assetId = res.assetId || res.asset_id || "";
  const uploadUrl = res.uploadUrl || res.upload_url || res.signedUrl || "";
  const expiresIn = Number(res.expiresIn || res.expires_in) || 300;

  if (!assetId || !uploadUrl) {
    throw new Error("استجابة غير مكتملة من خدمة الرفع (assetId أو uploadUrl مفقود)");
  }

  return {
    assetId,
    uploadUrl,
    path: res.path,
    expiresIn,
    expiresInSeconds: expiresIn,
  };
}

/**
 * Step 2 of Upload: Confirm upload after PUT file to uploadUrl.
 */
export async function completeAlaslyUpload(
  paramsOrAssetId: AlaslyUploadCompleteParams | string,
  durationFallback?: number,
  sizeBytesFallback?: number
): Promise<AlaslyUploadCompleteResult> {
  const params: AlaslyUploadCompleteParams =
    typeof paramsOrAssetId === "string"
      ? { assetId: paramsOrAssetId, duration: durationFallback, size_bytes: sizeBytesFallback }
      : paramsOrAssetId;

  if (!params.assetId) {
    throw new Error("assetId مطلوب لإتمام الرفع");
  }

  const payload: Record<string, any> = {
    assetId: params.assetId,
  };
  if (typeof params.duration === "number") payload.duration = params.duration;
  if (typeof params.size_bytes === "number") payload.size_bytes = params.size_bytes;

  const res = await callVideoApi<any>("/upload/complete", payload, "POST");

  return {
    videoId: res.videoId || res.video_id || params.assetId,
    assetId: res.assetId || res.asset_id || params.assetId,
    status: res.status || "ready",
    duration: res.duration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Video Metadata Queries
// ─────────────────────────────────────────────────────────────────────────────

export interface AlaslyVideoMetadata {
  videoId: string;
  title: string;
  status: "ready" | "processing" | "error" | string;
  duration?: number;
  size?: number;
  playbackKind?: string;
  createdAt?: string;
}

export async function getAlaslyVideo(videoId: string): Promise<AlaslyVideoMetadata> {
  if (!videoId) throw new Error("videoId is required");
  return callVideoApi<AlaslyVideoMetadata>(`/videos/${encodeURIComponent(videoId)}`, null, "GET");
}

export async function listAlaslyVideos(): Promise<AlaslyVideoMetadata[]> {
  return callVideoApi<AlaslyVideoMetadata[]>("/videos", null, "GET");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Webhook Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the X-Alasly-Signature header on incoming webhook requests.
 * Header format: sha256=<hmac>
 */
export function verifyAlaslyWebhookSignature(
  rawRequestBody: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!signatureHeader || typeof signatureHeader !== "string") return false;

  const secret = (
    process.env.VIDEO_WEBHOOK_SECRET ||
    process.env.ALASLY_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    process.env.VIDEO_API_SECRET ||
    process.env.ALASLY_API_SECRET ||
    ""
  ).trim();

  if (!secret) {
    console.error("[Alasly Webhook] No webhook secret configured to verify incoming signature.");
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawRequestBody).digest("hex");

  try {
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
