/**
 * YouTube private/unlisted video embed integration.
 *
 * YouTube does not provide server-side signed URLs — protection comes from:
 * 1. Videos set to "Unlisted" (not findable via search, only via direct link)
 * 2. The player iframe has no-referrer + our domain allowlisted in YT Studio
 * 3. Our watch page disables right-click + DevTools keyboard shortcuts (client-side)
 * 4. The embed URL is never exposed directly to students; it's served via our API
 *    and only the iframe src is set in JS, so it's not in the page source.
 *
 * For fully private videos, use the YouTube Data API v3 with OAuth2 — but
 * private videos require the video owner to be authenticated, which is complex.
 * The recommended pattern for EdTech is unlisted + referrer restriction.
 */

const YT_NOCOOKIE_HOST = "https://www.youtube-nocookie.com";

export interface YouTubeEmbedResponse {
  embedUrl: string;
  signed: false;
  expiresInSeconds: null;
}

export function getYouTubeEmbedUrl(videoId: string): YouTubeEmbedResponse {
  // youtube-nocookie.com prevents YT from setting tracking cookies and
  // also suppresses related video suggestions from other channels.
  // YouTube videos render through YouTubeSecurePlayer (IFrame API + click-shield),
  // so the brand/title/link is never clickable. These params harden the embed URL
  // itself too (the video ID is parsed from it): no native controls, no keyboard,
  // no related videos, nocookie host, our-wrapper-only fullscreen.
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
    embedUrl: `${YT_NOCOOKIE_HOST}/embed/${videoId}?${params.toString()}`,
    signed: false,
    expiresInSeconds: null,
  };
}
