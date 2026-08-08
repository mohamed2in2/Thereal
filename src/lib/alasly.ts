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
  const apiKey = process.env.ALASLY_API_KEY || "alk_06a5ofogdqo11inzwoqn186jukk0bh7o";
  const apiSecret = process.env.ALASLY_API_SECRET || "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq";

  if (!lessonId) {
    throw new Error("Native/Alasly Video ID is required");
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
