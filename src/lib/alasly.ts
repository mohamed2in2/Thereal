import crypto from "crypto";

/**
 * Native / Alasly Video SaaS Platform API Integration
 * Endpoint: /functions/v1/video-service/v1
 * Uses API Key + HMAC-SHA256 signature with 5-minute validity window.
 */

const ALASLY_V1_ENDPOINT = process.env.ALASLY_BASE_URL || "https://rkmsjkcnpmqpiugcsvld.supabase.co/functions/v1/video-service/v1";
const LEGACY_ENDPOINT = "https://rkmsjkcnpmqpiugcsvld.supabase.co/functions/v1/video-api";

export interface AlaslyPlaybackResult {
  token: string;
  expiresInSeconds: number;
  expiresAt: string;
  embedUrl: string;
  iframeHtml?: string;
  title?: string;
}

export async function getAlaslyPlaybackToken(lessonId: string, domain?: string): Promise<AlaslyPlaybackResult> {
  const apiKey = (process.env.ALASLY_API_KEY || "alk_06a5ofogdqo11inzwoqn186jukk0bh7o").trim();
  const apiSecret = (process.env.ALASLY_API_SECRET || "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq").trim();

  if (!lessonId) {
    throw new Error("Native/Alasly Video ID is required");
  }

  // Handle local video server streaming
  if (lessonId.startsWith("local_") || lessonId.endsWith(".mp4") || lessonId.endsWith(".webm") || lessonId.endsWith(".mov")) {
    return {
      token: "local",
      expiresInSeconds: 86400,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      embedUrl: `/api/videos/stream/${encodeURIComponent(lessonId)}`,
      title: "Local Native Video",
    };
  }

  const currentDomain = domain || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    videoId: lessonId,
    video_id: lessonId,
    lesson_id: lessonId,
    domain: currentDomain,
  });

  const hmacPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(hmacPayload).digest("hex");

  try {
    const res = await fetch(`${ALASLY_V1_ENDPOINT}/playback/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "X-Api-Key": apiKey,
        "x-timestamp": timestamp,
        "X-Timestamp": timestamp,
        "x-signature": signature,
        "X-Alasly-Signature": signature,
      },
      body,
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok && (json.token || json.embed_url || json.ok)) {
      const token = json.token || json.playback_token || "";
      let embedUrl = json.embed_url || `https://alasly.lovable.app/embed/lesson/${lessonId}?key=${token}`;

      // Fix iframe parameter: change api_key= to key= if returned by endpoint
      if (embedUrl.includes("api_key=")) {
        embedUrl = embedUrl.replace("api_key=", "key=");
      }

      return {
        token,
        expiresInSeconds: json.expires_in || 120,
        expiresAt: json.expires_at || new Date(Date.now() + 120 * 1000).toISOString(),
        embedUrl,
        iframeHtml: json.iframe,
        title: json.title || json.lesson?.title,
      };
    }
  } catch (v1Err) {
    console.warn("Native Video V1 playback token endpoint failed, attempting legacy endpoint fallback:", v1Err);
  }

  // Fallback to legacy endpoint if V1 fails
  const legacyRes = await fetch(LEGACY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
    },
    body: JSON.stringify({
      action: "playback",
      lesson_id: lessonId,
      videoId: lessonId,
      domain: currentDomain,
    }),
    cache: "no-store",
  });

  const legacyJson = await legacyRes.json();

  if (!legacyRes.ok || !legacyJson.ok) {
    throw new Error(legacyJson.error || `Native Video API error (${legacyRes.status})`);
  }

  let embedUrl = legacyJson.embed_url || `https://alasly.lovable.app/embed/lesson/${lessonId}?key=${legacyJson.token}`;
  if (embedUrl.includes("api_key=")) {
    embedUrl = embedUrl.replace("api_key=", "key=");
  }

  return {
    token: legacyJson.token,
    expiresInSeconds: legacyJson.expires_in || 120,
    expiresAt: legacyJson.expires_at || new Date(Date.now() + 120 * 1000).toISOString(),
    embedUrl,
    iframeHtml: legacyJson.iframe,
    title: legacyJson.lesson?.title,
  };
}

export interface AlaslyUploadInitResult {
  uploadUrl: string;
  assetId: string;
  expiresInSeconds?: number;
}

export interface AlaslyUploadCompleteResult {
  videoId: string;
  assetId: string;
  status: string;
}

export async function initAlaslyUpload(filename: string, contentType: string, fileSize?: number): Promise<AlaslyUploadInitResult> {
  const apiKey = (process.env.ALASLY_API_KEY || "alk_06a5ofogdqo11inzwoqn186jukk0bh7o").trim();
  const apiSecret = (process.env.ALASLY_API_SECRET || "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq").trim();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    filename,
    file_name: filename,
    contentType: contentType || "video/mp4",
    content_type: contentType || "video/mp4",
    size: fileSize || 0,
  });

  const hmacPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(hmacPayload).digest("hex");

  const res = await fetch(`${ALASLY_V1_ENDPOINT}/upload/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "X-Api-Key": apiKey,
      "x-timestamp": timestamp,
      "X-Timestamp": timestamp,
      "x-signature": signature,
      "X-Alasly-Signature": signature,
    },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || (!json.uploadUrl && !json.upload_url && !json.assetId && !json.asset_id)) {
    const rawErr = json.error || json.msg || json.message || `Failed to initialize Native video upload (${res.status})`;
    if (rawErr === "invalid_api_key" || res.status === 401 || res.status === 403) {
      throw new Error("مفتاح API الخاص بخدمة Native Video غير مفعّل أو غير صحيح. يرجى إضافة ALASLY_API_KEY و ALASLY_API_SECRET في ملف الـ .env على السيرفر");
    }
    throw new Error(rawErr);
  }

  return {
    uploadUrl: json.uploadUrl || json.upload_url || json.signedUrl || "",
    assetId: json.assetId || json.asset_id || "",
    expiresInSeconds: json.expires_in || 300,
  };
}

export async function completeAlaslyUpload(assetId: string): Promise<AlaslyUploadCompleteResult> {
  const apiKey = (process.env.ALASLY_API_KEY || "alk_06a5ofogdqo11inzwoqn186jukk0bh7o").trim();
  const apiSecret = (process.env.ALASLY_API_SECRET || "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq").trim();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    assetId,
    asset_id: assetId,
  });

  const hmacPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(hmacPayload).digest("hex");

  const res = await fetch(`${ALASLY_V1_ENDPOINT}/upload/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "X-Api-Key": apiKey,
      "x-timestamp": timestamp,
      "X-Timestamp": timestamp,
      "x-signature": signature,
      "X-Alasly-Signature": signature,
    },
    body,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || (!json.videoId && !json.video_id)) {
    const rawErr = json.error || json.msg || json.message || `Failed to complete Native video upload (${res.status})`;
    if (rawErr === "invalid_api_key" || res.status === 401 || res.status === 403) {
      throw new Error("مفتاح API الخاص بخدمة Native Video غير مفعّل أو غير صحيح. يرجى إضافة ALASLY_API_KEY و ALASLY_API_SECRET في ملف الـ .env على السيرفر");
    }
    throw new Error(rawErr);
  }

  return {
    videoId: json.videoId || json.video_id || assetId,
    assetId: json.assetId || json.asset_id || assetId,
    status: json.status || "ready",
  };
}
