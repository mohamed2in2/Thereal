/**
 * Alasly Video API Integration (Supabase Edge Function)
 *
 * Requests playback tokens and embed URLs from Alasly's video platform.
 */

const ALASLY_ENDPOINT = "https://rkmsjkcnpmqpiugcsvld.supabase.co/functions/v1/video-api";

export interface AlaslyPlaybackResult {
  token: string;
  expiresInSeconds: number;
  expiresAt: string;
  embedUrl: string;
  iframeHtml?: string;
  title?: string;
}

export async function getAlaslyPlaybackToken(lessonId: string): Promise<AlaslyPlaybackResult> {
  const apiKey = process.env.ALASLY_API_KEY || "alk_06a5ofogdqo11inzwoqn186jukk0bh7o";
  const apiSecret = process.env.ALASLY_API_SECRET || "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq";

  if (!lessonId) {
    throw new Error("Alasly Lesson ID is required");
  }

  const response = await fetch(ALASLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
    },
    body: JSON.stringify({
      action: "playback",
      lesson_id: lessonId,
    }),
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Alasly API error (${response.status})`);
  }

  return {
    token: json.token,
    expiresInSeconds: json.expires_in || 3600,
    expiresAt: json.expires_at || new Date(Date.now() + 3600 * 1000).toISOString(),
    embedUrl: json.embed_url || `https://alasly.lovable.app/embed/lesson/${lessonId}?token=${json.token}`,
    iframeHtml: json.iframe,
    title: json.lesson?.title,
  };
}
