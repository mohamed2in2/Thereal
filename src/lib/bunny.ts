/**
 * Bunny Stream integration for secure video playback.
 * Bunny signed URLs require a token derived from: SHA256(securityKey + videoPath + expiry + ip)
 * We use the embed player URL with a signed token so students can't extract the CDN URL.
 */

const BUNNY_API_KEY = process.env.BUNNY_API_KEY ?? "";
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID ?? "";
const BUNNY_TOKEN_KEY = process.env.BUNNY_TOKEN_AUTHENTICATION_KEY ?? "";
// Base pull zone hostname — e.g. "iframe.mediadelivery.net"
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME ?? "iframe.mediadelivery.net";

export interface BunnyEmbedResponse {
  embedUrl: string;
  signed: boolean;
  expiresInSeconds: number;
}

function hexSha256(data: Uint8Array<ArrayBuffer>): Promise<string> {
  return crypto.subtle.digest("SHA-256", data).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function getBunnyEmbedUrl(videoId: string): Promise<BunnyEmbedResponse> {
  const TTL_SECONDS = 3600;

  if (!BUNNY_TOKEN_KEY || !BUNNY_LIBRARY_ID) {
    if (!BUNNY_API_KEY && !BUNNY_LIBRARY_ID) {
      // Full mock: no env vars at all
      return {
        embedUrl: `https://${BUNNY_CDN_HOSTNAME}/embed/${BUNNY_LIBRARY_ID || "0"}/${videoId}`,
        signed: false,
        expiresInSeconds: TTL_SECONDS,
      };
    }
    // Library ID set but no token key — return unsigned embed URL
    return {
      embedUrl: `https://${BUNNY_CDN_HOSTNAME}/embed/${BUNNY_LIBRARY_ID}/${videoId}`,
      signed: false,
      expiresInSeconds: TTL_SECONDS,
    };
  }

  // Bunny signed embed URL token formula:
  // token = SHA256(tokenKey + videoId + expiry)
  // URL: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token={token}&expires={expiry}
  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const raw = `${BUNNY_TOKEN_KEY}${videoId}${expiry}`;
  const token = await hexSha256(new TextEncoder().encode(raw) as unknown as Uint8Array<ArrayBuffer>);

  const embedUrl =
    `https://${BUNNY_CDN_HOSTNAME}/embed/${BUNNY_LIBRARY_ID}/${videoId}` +
    `?token=${token}&expires=${expiry}&autoplay=false`;

  return { embedUrl, signed: true, expiresInSeconds: TTL_SECONDS };
}
