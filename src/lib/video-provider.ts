/**
 * Unified video provider dispatcher.
 * Resolves the correct embed URL based on the video's provider field.
 */

import { getVdoCipherOtp } from "./vdocipher";
import { getBunnyEmbedUrl } from "./bunny";
import { getYouTubeEmbedUrl } from "./youtube";
import { getAlaslyPlaybackToken } from "./alasly";

export type VideoProvider = "vdocipher" | "bunny" | "youtube" | "alasly";

export interface VideoEmbedResult {
  embedUrl: string;
  provider: VideoProvider;
  signed: boolean;
  expiresInSeconds: number | null;
}

/**
 * Given a video record's provider + providerVideoId (with legacy vdoCipherId fallback),
 * returns a ready-to-embed URL for the player iframe.
 */
export async function resolveEmbedUrl(video: {
  videoProvider: string;
  providerVideoId: string;
  vdoCipherId: string;
}): Promise<VideoEmbedResult> {
  const provider = (video.videoProvider || "vdocipher") as VideoProvider;

  // Legacy rows have providerVideoId="" and vdoCipherId set — fall back gracefully.
  const id = video.providerVideoId || video.vdoCipherId;

  if (!id) {
    throw new Error("Video has no provider ID configured");
  }

  switch (provider) {
    case "alasly": {
      const result = await getAlaslyPlaybackToken(id);
      return { embedUrl: result.embedUrl, provider, signed: true, expiresInSeconds: result.expiresInSeconds };
    }
    case "bunny": {
      const result = await getBunnyEmbedUrl(id);
      return { embedUrl: result.embedUrl, provider, signed: result.signed, expiresInSeconds: result.expiresInSeconds };
    }
    case "youtube": {
      const result = getYouTubeEmbedUrl(id);
      return { embedUrl: result.embedUrl, provider, signed: false, expiresInSeconds: null };
    }
    case "vdocipher":
    default: {
      const result = await getVdoCipherOtp(id);
      return { embedUrl: result.embedUrl, provider: "vdocipher", signed: true, expiresInSeconds: 3600 };
    }
  }
}

export const PROVIDER_LABELS: Record<VideoProvider, string> = {
  vdocipher: "VdoCipher",
  bunny: "Bunny Stream",
  youtube: "YouTube Private",
  alasly: "Native (Super Native Security)",
};

/** Validates a provider ID format per provider rules */
export function validateProviderId(provider: VideoProvider, id: string): string | null {
  if (!id || !id.trim()) return "معرف الفيديو مطلوب";

  switch (provider) {
    case "alasly":
      if (!/^[a-z0-9-]+$/i.test(id)) return "معرف درس Native يجب أن يكون UUID صالحاً";
      break;
    case "vdocipher":
      if (!/^[a-z0-9-]+$/i.test(id)) return "معرف VdoCipher يحتوي على أحرف وأرقام وشرطات فقط";
      break;
    case "bunny":
      if (!/^[a-z0-9-]+$/i.test(id)) return "معرف Bunny Stream يحتوي على أحرف وأرقام وشرطات فقط";
      break;
    case "youtube":
      // YouTube video IDs are exactly 11 chars: letters, digits, -, _
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return "معرف YouTube يجب أن يكون 11 حرفاً (مثال: dQw4w9WgXcQ)";
      break;
  }
  return null;
}
