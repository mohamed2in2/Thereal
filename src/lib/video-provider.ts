/**
 * Unified video provider dispatcher.
 * Resolves the correct embed URL based on the video's provider field.
 */

import { getVdoCipherOtp } from "./vdocipher";
import { getBunnyEmbedUrl } from "./bunny";
import { getYouTubeEmbedUrl, extractYouTubeVideoId } from "./youtube";
import { getAlaslyPlaybackToken } from "./alasly";

export type VideoProvider = "vdocipher" | "bunny" | "youtube" | "alasly";

export interface VideoEmbedResult {
  embedUrl: string;
  provider: VideoProvider;
  signed: boolean;
  expiresInSeconds: number | null;
}

import { extractGoogleDriveFileId } from "./google-drive";

/** Sanitizes and extracts clean provider video ID based on provider rules */
export function cleanProviderVideoId(provider: VideoProvider, input: string): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();

  // If input is YouTube URL, always extract YT ID
  const ytExtracted = extractYouTubeVideoId(trimmed);
  if (ytExtracted && provider === "youtube") {
    return ytExtracted;
  }

  // If input is Google Drive URL for Alasly/Native provider, normalize to gdrive_ID
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId && provider === "alasly") {
    return `gdrive_${driveId}`;
  }

  switch (provider) {
    case "youtube": {
      return ytExtracted || trimmed;
    }
    case "bunny": {
      const guidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (guidMatch) return guidMatch[0];
      return trimmed;
    }
    case "alasly": {
      return driveId ? `gdrive_${driveId}` : trimmed;
    }
    case "vdocipher":
    default:
      return trimmed;
  }
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
  const rawId = (video.providerVideoId || video.vdoCipherId || "").trim();

  if (!rawId) {
    throw new Error("Video has no provider ID configured");
  }

  // Auto-detect YouTube links even if provider was mistakenly set to alasly/vdocipher
  const ytId = extractYouTubeVideoId(rawId);
  if (ytId || video.videoProvider === "youtube") {
    const cleanYt = ytId || rawId;
    const result = getYouTubeEmbedUrl(cleanYt);
    return { embedUrl: result.embedUrl, provider: "youtube", signed: false, expiresInSeconds: null };
  }

  const provider = (video.videoProvider || "vdocipher") as VideoProvider;
  const id = cleanProviderVideoId(provider, rawId);

  switch (provider) {
    case "alasly": {
      const result = await getAlaslyPlaybackToken(id);
      return { embedUrl: result.embedUrl, provider, signed: true, expiresInSeconds: result.expiresInSeconds };
    }
    case "bunny": {
      const result = await getBunnyEmbedUrl(id);
      return { embedUrl: result.embedUrl, provider, signed: result.signed, expiresInSeconds: result.expiresInSeconds };
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
  const trimmed = id.trim();

  switch (provider) {
    case "alasly":
      if (!/^[a-z0-9_.-]+$/i.test(trimmed)) return "معرف درس Native يحتوي على أحرف وأرقام وشرطات ونقاط فقط";
      break;
    case "vdocipher":
      if (!/^[a-z0-9_.-]+$/i.test(trimmed)) return "معرف VdoCipher يحتوي على أحرف وأرقام وشرطات ونقاط فقط";
      break;
    case "bunny": {
      const cleanBunny = cleanProviderVideoId("bunny", trimmed);
      if (!/^[a-z0-9_.-]+$/i.test(cleanBunny)) return "معرف Bunny Stream يحتوي على أحرف وأرقام وشرطات ونقاط فقط";
      break;
    }
    case "youtube": {
      const cleanYt = extractYouTubeVideoId(trimmed);
      if (!cleanYt || !/^[a-zA-Z0-9_-]{10,12}$/.test(cleanYt)) {
        return "رابط أو معرف YouTube غير صالح. يرجى إدخال رابط فيديو صالح (مثال: https://youtu.be/... أو https://youtube.com/watch?v=...) أو معرف الفيديو";
      }
      break;
    }
  }
  return null;
}
