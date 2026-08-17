import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  videoMediaMetadata?: {
    width?: number;
    height?: number;
    durationMillis?: string;
  };
}

export interface GoogleDriveDownloadResult {
  success: boolean;
  videoId: string;
  filename: string;
  title: string;
  durationMinutes: number;
  sizeBytes: number;
  mimeType: string;
  videoProvider: "alasly";
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");

// In-memory token cache to prevent unnecessary JWT signing & token requests
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Normalizes and extracts Google Drive file ID from various URL formats or raw ID.
 */
export function extractGoogleDriveFileId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // Pattern 1: /file/d/{id} or /file/u/0/d/{id}
  const fileDPattern = /\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/;
  const matchD = trimmed.match(fileDPattern);
  if (matchD?.[1]) return matchD[1];

  // Pattern 2: id={id} in query string (open?id=..., uc?id=..., etc.)
  const queryPattern = /[?&]id=([a-zA-Z0-9_-]{20,})/;
  const matchQuery = trimmed.match(queryPattern);
  if (matchQuery?.[1]) return matchQuery[1];

  // Pattern 3: /d/{id}/
  const shortDPattern = /\/d\/([a-zA-Z0-9_-]{20,})/;
  const matchShortD = trimmed.match(shortDPattern);
  if (matchShortD?.[1]) return matchShortD[1];

  // Pattern 4: Raw file ID directly (at least 20 chars, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Returns Google Service Account credentials safely from environment variables.
 * Never logs credentials.
 */
function getGoogleCredentials() {
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  let privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  const projectId = (process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID || "").trim();

  if (!email || !privateKey) {
    throw new Error(
      "بيانات حساب خدمة Google Drive (Service Account) غير مهيأة في متغيرات البيئة. يرجى مراجعة إعدادات السيرفر."
    );
  }

  // Handle literal escaped newlines "\n" if present in string
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return { email, privateKey, projectId };
}

/**
 * Signs an RS256 JWT assertion and exchanges it for a Google OAuth2 Bearer Access Token.
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token;
  }

  const { email, privateKey } = getGoogleCredentials();

  // Create JWT Header & Payload
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;

  // Sign with RSA-SHA256 using native crypto
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer
    .sign(privateKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signedJwt = `${unsignedToken}.${signature}`;

  // Exchange signed JWT for OAuth2 Access Token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }).toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
    throw new Error(`فشل المصادقة مع Google Cloud: ${errorMsg}`);
  }

  const token = tokenData.access_token as string;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  cachedAccessToken = {
    token,
    expiresAt: now + expiresIn,
  };

  return token;
}

/**
 * Retrieves file metadata from Google Drive API.
 */
export async function getGoogleDriveFileMetadata(fileId: string): Promise<GoogleDriveFileMetadata> {
  const token = await getGoogleDriveAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,videoMediaMetadata&supportsAllDrives=true`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errCode = res.status;
    if (errCode === 404) {
      throw new Error("الفيديو غير موجود في Google Drive أو تم حذفه.");
    }
    if (errCode === 403) {
      throw new Error(
        "تعذر الوصول للفيديو. يرجى التأكد من مشاركة الفيديو في Google Drive مع الإيميل: code-up-drive-downloader@gen-lang-client-0511580613.iam.gserviceaccount.com أو جعله متاحاً لمن يملك الرابط."
      );
    }
    throw new Error(errBody.error?.message || `خطأ Google Drive (${errCode})`);
  }

  return (await res.json()) as GoogleDriveFileMetadata;
}

/**
 * Downloads a video from Google Drive directly into Code-UP's Native Video pipeline
 * using streaming to avoid memory bloat.
 */
export async function downloadGoogleDriveVideo(
  fileId: string,
  options?: { maxSizeBytes?: number }
): Promise<GoogleDriveDownloadResult> {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // 1. Verify metadata & access
  const metadata = await getGoogleDriveFileMetadata(fileId);

  const maxBytes = options?.maxSizeBytes || 2 * 1024 * 1024 * 1024; // 2 GB default limit
  const fileSize = Number(metadata.size) || 0;
  if (fileSize > maxBytes) {
    const sizeMB = Math.round(fileSize / (1024 * 1024));
    const maxMB = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`حجم الفيديو (${sizeMB} ميجابايت) يتجاوز الحد الأقصى المسموح (${maxMB} ميجابايت).`);
  }

  // 2. Determine extension and target filename
  const originalName = metadata.name || "video.mp4";
  let ext = path.extname(originalName).toLowerCase();
  if (!ext || ext.length < 2) {
    if (metadata.mimeType?.includes("mp4")) ext = ".mp4";
    else if (metadata.mimeType?.includes("webm")) ext = ".webm";
    else if (metadata.mimeType?.includes("quicktime") || metadata.mimeType?.includes("mov")) ext = ".mov";
    else ext = ".mp4";
  }

  const randomId = crypto.randomBytes(8).toString("hex");
  const filename = `local_${Date.now()}_${randomId}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, filename);

  // 3. Stream download from Google Drive API
  const token = await getGoogleDriveAccessToken();
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(`فشل تحميل محتوى الفيديو من Google Drive: ${errText || response.statusText}`);
  }

  // Pipe web readable stream directly to disk write stream
  const nodeReadable = Readable.fromWeb(response.body as any);
  const writeStream = fs.createWriteStream(targetPath);

  try {
    await pipeline(nodeReadable, writeStream);
  } catch (err: any) {
    // Cleanup partial file on error
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch {}
    }
    throw new Error(`حدث انقطاع أثناء تحميل الفيديو: ${err.message}`);
  }

  // Calculate duration in minutes if provided in metadata
  let durationMinutes = 0;
  if (metadata.videoMediaMetadata?.durationMillis) {
    const millis = Number(metadata.videoMediaMetadata.durationMillis);
    if (!isNaN(millis) && millis > 0) {
      durationMinutes = Math.ceil(millis / 60000);
    }
  }

  // Clean title (remove extension)
  const cleanTitle = originalName.replace(/\.[^/.]+$/, "").trim() || "درس فيديو";

  return {
    success: true,
    videoId: filename,
    filename,
    title: cleanTitle,
    durationMinutes,
    sizeBytes: fileSize,
    mimeType: metadata.mimeType || "video/mp4",
    videoProvider: "alasly",
  };
}
