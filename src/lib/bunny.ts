/**
 * Bunny Stream integration for secure video playback.
 * Bunny signed URLs require a token derived from: SHA256(securityKey + videoPath + expiry + ip)
 * We use the embed player URL with a signed token so students can't extract the CDN URL.
 */

const BUNNY_API_KEY = process.env.BUNNY_API_KEY ?? "";
// `||` not `??`: .env.example ships these keys as empty strings, and `??` would
// stop at "" instead of trying the next name.
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || process.env.BUNNY_STREAM_LIBRARY_ID || "";
// The documented env names are BUNNY_TOKEN_KEY / BUNNY_STREAM_TOKEN_AUTH_KEY;
// only BUNNY_TOKEN_AUTHENTICATION_KEY was read, so a correctly configured
// deployment still fell through to *unsigned* embed URLs. Accept all three.
const BUNNY_TOKEN_KEY =
  process.env.BUNNY_TOKEN_AUTHENTICATION_KEY ||
  process.env.BUNNY_TOKEN_KEY ||
  process.env.BUNNY_STREAM_TOKEN_AUTH_KEY ||
  "";
// Base player embed hostname — "iframe.mediadelivery.net"
const BUNNY_PLAYER_HOSTNAME = process.env.BUNNY_PLAYER_HOSTNAME || "iframe.mediadelivery.net";
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "vz-d91c75ba-4c6.b-cdn.net";

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
        embedUrl: `https://${BUNNY_PLAYER_HOSTNAME}/embed/${BUNNY_LIBRARY_ID || "0"}/${videoId}`,
        signed: false,
        expiresInSeconds: TTL_SECONDS,
      };
    }
    // Library ID set but no token key — return unsigned embed URL
    return {
      embedUrl: `https://${BUNNY_PLAYER_HOSTNAME}/embed/${BUNNY_LIBRARY_ID}/${videoId}`,
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
    `https://${BUNNY_PLAYER_HOSTNAME}/embed/${BUNNY_LIBRARY_ID}/${videoId}` +
    `?token=${token}&expires=${expiry}&autoplay=false`;

  return { embedUrl, signed: true, expiresInSeconds: TTL_SECONDS };
}

/**
 * Creates a new video placeholder in Bunny Stream library.
 */
export async function createBunnyVideo(title: string): Promise<{ guid: string }> {
  const libraryId = BUNNY_LIBRARY_ID;
  const apiKey = BUNNY_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("BUNNY_LIBRARY_ID / BUNNY_API_KEY غير مهيأة على السيرفر");
  }

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: "POST",
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title: title || "درس فيديو جديد" }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`فشل إنشاء فيديو جديد في Bunny Stream (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { guid: data.guid };
}

/**
 * Pipes a binary stream directly into a Bunny Stream video without saving to VPS disk.
 */
export async function uploadStreamToBunny(guid: string, stream: any): Promise<void> {
  const libraryId = BUNNY_LIBRARY_ID;
  const apiKey = BUNNY_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("BUNNY_LIBRARY_ID / BUNNY_API_KEY غير مهيأة على السيرفر");
  }

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: stream,
    // @ts-ignore
    duplex: "half",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`فشل رفع الفيديو إلى Bunny Stream (${res.status}): ${errText}`);
  }
}
