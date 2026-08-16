/**
 * YouTube private/unlisted video embed integration & URL parser.
 *
 * YouTube does not provide server-side signed URLs — protection comes from:
 * 1. Videos set to "Unlisted" (not findable via search, only via direct link)
 * 2. The player iframe has no-referrer + our domain allowlisted in YT Studio
 * 3. Our watch page disables right-click + DevTools keyboard shortcuts (client-side)
 * 4. The embed URL is never exposed directly to students; it's served via our API
 *    and only the iframe src is set in JS, so it's not in the page source.
 */

export const YT_NOCOOKIE_HOST = "https://www.youtube-nocookie.com";

export interface YouTubeEmbedResponse {
  embedUrl: string;
  signed: false;
  expiresInSeconds: null;
}

/**
 * Extracts a clean YouTube Video ID from any YouTube URL or raw ID string.
 * Supported formats:
 * - youtu.be/<id> (e.g. https://youtu.be/dQw4w9WgXcQ?si=...)
 * - youtube.com/watch?v=<id>
 * - youtube.com/embed/<id>
 * - youtube.com/v/<id>
 * - youtube.com/shorts/<id>
 * - youtube.com/live/<id>
 * - m.youtube.com/watch?v=<id>
 * - Raw video ID (10 to 12 chars: letters, digits, _, -)
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. If it's a raw video ID (10 to 12 alphanumeric/dash/underscore chars)
  if (/^[a-zA-Z0-9_-]{10,12}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. youtu.be/<id> (short links)
  const shortMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{10,12})/i);
  if (shortMatch?.[1]) {
    return shortMatch[1];
  }

  // 3. youtube.com/watch?v=<id> or ?feature=...&v=<id>
  const watchMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/watch\?(?:[^&]+&)*v=([a-zA-Z0-9_-]{10,12})/i);
  if (watchMatch?.[1]) {
    return watchMatch[1];
  }

  // 4. youtube.com/embed/<id>, /v/<id>, /shorts/<id>, /live/<id>
  const pathMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{10,12})/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  // 5. Fallback URL parser using URL object if applicable
  try {
    const urlString = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(urlString);
    if (parsed.hostname.includes("youtu.be")) {
      const pathId = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (/^[a-zA-Z0-9_-]{10,12}$/.test(pathId)) return pathId;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{10,12}$/.test(v)) return v;
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "v", "shorts", "live"].includes(pathParts[0]) && pathParts[1] && /^[a-zA-Z0-9_-]{10,12}$/.test(pathParts[1])) {
        return pathParts[1];
      }
    }
  } catch {
    // Ignore URL parse error and proceed to generic extraction
  }

  // 6. Generic regex extraction for any 10-12 character video ID following common markers
  const genericMatch = trimmed.match(/(?:v[=/]|embed\/|youtu\.be\/|\/v\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{10,12})/i);
  if (genericMatch?.[1]) {
    return genericMatch[1];
  }

  return null;
}

/**
 * Returns whether a given string is a valid YouTube video ID or URL.
 */
export function isValidYouTubeVideoId(input: string): boolean {
  return extractYouTubeVideoId(input) !== null;
}

/**
 * Builds a hardened embed URL for YouTube videos.
 * Handles both raw IDs and full URLs safely.
 */
export function getYouTubeEmbedUrl(inputOrId: string): YouTubeEmbedResponse {
  const cleanId = extractYouTubeVideoId(inputOrId) || inputOrId.trim();

  // youtube-nocookie.com prevents YT from setting tracking cookies and
  // also suppresses related video suggestions from other channels.
  // YouTube videos render through YouTubeSecurePlayer (IFrame API + click-shield),
  // so the brand/title/link is never clickable.
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    controls: "0",
    disablekb: "1",
    iv_load_policy: "3",
    fs: "0",
    playsinline: "1",
    enablejsapi: "1",
  });

  return {
    embedUrl: `${YT_NOCOOKIE_HOST}/embed/${cleanId}?${params.toString()}`,
    signed: false,
    expiresInSeconds: null,
  };
}
