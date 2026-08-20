import crypto from "node:crypto";

/**
 * Axinom Multi-DRM Configuration & License Token Generator.
 * Handles Widevine, PlayReady, and FairPlay entitlement token minting.
 */

export const AXINOM_CONFIG = {
  tenantId: process.env.AXINOM_TENANT_ID || "a85ddc8b-8c74-4fe3-806d-1f2f87df5745",
  communicationKeyId: process.env.AXINOM_COMMUNICATION_KEY_ID || "c7f03846-00ba-4af6-9fa4-b4ac0141be68",
  keySeedId: process.env.AXINOM_KEY_SEED_ID || "17d4929c-8f6a-45dc-89ed-b4ac0141be68",
  endpoints: {
    widevine: process.env.AXINOM_WIDEVINE_LICENSE_URL || "https://a85ddc8b.drm-widevine-licensing.axprod.net/AcquireLicense",
    playready: process.env.AXINOM_PLAYREADY_LICENSE_URL || "https://a85ddc8b.drm-playready-licensing.axprod.net/AcquireLicense",
    fairplay: process.env.AXINOM_FAIRPLAY_LICENSE_URL || "https://a85ddc8b.drm-fairplay-licensing.axprod.net/AcquireLicense",
    fairplayCert: process.env.AXINOM_FAIRPLAY_CERT_URL || "",
    spekeV2: "https://a85ddc8b.key-service-management.axprod.net/api/SpekeV2",
    cenc: "https://a85ddc8b.key-service-management.axprod.net/api/WidevineProtectionInfo",
  },
};

/**
 * Returns the Communication Key buffer for signing tokens.
 */
function getCommunicationKeyBuffer(): Buffer {
  const rawKey = (process.env.AXINOM_COMMUNICATION_KEY || "").trim();
  if (!rawKey) {
    console.error("[Axinom DRM] Warning: AXINOM_COMMUNICATION_KEY is not configured in .env. DRM tokens will be rejected by Axinom license servers.");
    return Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex");
  }

  // 64-char Hex format
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }
  // 44-char Base64 format with trailing '=' or standard base64 structure
  if (/^[A-Za-z0-9+/]{42,43}={0,2}$/.test(rawKey) && rawKey.endsWith("=")) {
    return Buffer.from(rawKey, "base64");
  }
  // UTF-8 or raw binary string
  return Buffer.from(rawKey, "utf-8");
}

export interface AxinomTokenOptions {
  videoId: string;
  userId?: string;
  expiresInSeconds?: number;
  allowPersistence?: boolean;
  keyId?: string;
  key?: string;
}


export interface AxinomDrmPayload {
  token: string;
  manifestUrl: string;
  licenseServers: {
    widevine: string;
    playready: string;
    fairplay: string;
    fairplayCertUrl?: string;
  };
  expiresAt: string;
  expiresInSeconds: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Creates a signed Axinom DRM Entitlement Token (JWT) with X-AxDRM-Message schema.
 */
export function createAxinomDrmToken(options: AxinomTokenOptions): AxinomDrmPayload {
  const expiresInSeconds = options.expiresInSeconds || 4 * 60 * 60; // 4 hours default
  const nowUnix = Math.floor(Date.now() / 1000);
  const expUnix = nowUnix + expiresInSeconds;
  const expiresAt = new Date(expUnix * 1000).toISOString();

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  // Determine content keys source (explicit inline key or Key-seed derivation)
  let contentKeysSource: Record<string, any> = {
    key_seed: {
      key_seed_id: AXINOM_CONFIG.keySeedId,
    },
  };

  try {
    let keyId = options.keyId;
    let key = options.key;
    if (!keyId || !key) {
      const fs = require("node:fs");
      const path = require("node:path");
      const safeId = String(options.videoId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const keyFilePath = path.resolve(process.cwd(), "uploads", "drm-keys", `${safeId}.json`);
      if (fs.existsSync(keyFilePath)) {
        const keyData = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
        if (keyData.keyId && keyData.key) {
          keyId = keyData.keyId;
          key = keyData.key;
        }
      }
    }
    if (keyId && key) {
      contentKeysSource = {
        inline: [
          {
            id: keyId,
            key: key,
          },
        ],
      };
    }
  } catch {
    // If not found, use Key-seed ID
  }

  const entitlementMessage: Record<string, any> = {
    type: "entitlement_message",
    version: 2,
    iat: nowUnix,
    nbf: nowUnix - 30, // 30s clock skew allowance
    exp: expUnix,
    license: {
      allow_persistence: options.allowPersistence || false,
    },
    content_keys_source: contentKeysSource,
  };

  // Optional user tracking metadata
  if (options.userId) {
    entitlementMessage.user_id = options.userId;
  }

  // Wrap in Axinom License Service Message envelope
  const licenseServiceMessage = {
    version: 1,
    com_key_id: AXINOM_CONFIG.communicationKeyId,
    message: entitlementMessage,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(licenseServiceMessage));
  const signingInput = `${encodedHeader}.${encodedPayload}`;


  const keyBuffer = getCommunicationKeyBuffer();
  const signature = crypto
    .createHmac("sha256", keyBuffer)
    .update(signingInput)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  const token = `${signingInput}.${encodedSignature}`;

  // Local or remote manifest URL
  let manifestUrl = options.videoId;
  if (!manifestUrl.startsWith("http://") && !manifestUrl.startsWith("https://")) {
    if (options.videoId.startsWith("gdrive_") || options.videoId.startsWith("local_")) {
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const safeId = String(options.videoId).replace(/[^a-zA-Z0-9_-]/g, "_");
        const mpdPath = path.resolve(process.cwd(), "uploads", "drm", safeId, "manifest.mpd");
        if (fs.existsSync(mpdPath)) {
          manifestUrl = `/api/videos/drm/${encodeURIComponent(options.videoId)}/manifest.mpd`;
        } else {
          manifestUrl = `/api/videos/stream/${encodeURIComponent(options.videoId)}`;
        }
      } catch {
        manifestUrl = `/api/videos/drm/${encodeURIComponent(options.videoId)}/manifest.mpd`;
      }
    } else {
      manifestUrl = `/api/videos/drm/${encodeURIComponent(options.videoId)}/manifest.mpd`;
    }
  }


  return {
    token,
    manifestUrl,
    licenseServers: {
      widevine: AXINOM_CONFIG.endpoints.widevine,
      playready: AXINOM_CONFIG.endpoints.playready,
      fairplay: AXINOM_CONFIG.endpoints.fairplay,
      fairplayCertUrl: AXINOM_CONFIG.endpoints.fairplayCert || undefined,
    },
    expiresAt,
    expiresInSeconds,
  };
}
