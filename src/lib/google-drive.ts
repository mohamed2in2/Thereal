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

  // Configurable size limit: Default 6 GB (to easily handle 3GB & 5GB teacher videos)
  const envMaxGb = Number(process.env.GOOGLE_DRIVE_MAX_FILE_SIZE_GB) || 6;
  const maxBytes = options?.maxSizeBytes || envMaxGb * 1024 * 1024 * 1024;
  const fileSize = Number(metadata.size) || 0;
  if (fileSize > maxBytes) {
    const sizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
    const maxGB = (maxBytes / (1024 * 1024 * 1024)).toFixed(0);
    throw new Error(`حجم الفيديو (${sizeGB} جيجابايت) يتجاوز الحد الأقصى المسموح به (${maxGB} جيجابايت).`);
  }

  // 2. Validate MIME type & file extension (strictly allow only video formats)
  const mime = (metadata.mimeType || "").toLowerCase();
  const originalName = metadata.name || "video.mp4";
  let ext = path.extname(originalName).toLowerCase();

  const isVideoMime =
    mime.startsWith("video/") ||
    mime === "application/octet-stream" ||
    mime === "application/x-matroska" ||
    mime === "application/mp4";

  const allowedExtensions = [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi", ".ts"];
  const hasValidExt = ext && allowedExtensions.includes(ext);

  if (!isVideoMime && !hasValidExt) {
    throw new Error(
      `نوع الملف (${mime || "غير معروف"}) ليس ملف فيديو صالحاً. يُسمح فقط بملفات الفيديو (MP4, WebM, MOV, MKV).`
    );
  }

  if (!ext || ext.length < 2) {
    if (mime.includes("mp4")) ext = ".mp4";
    else if (mime.includes("webm")) ext = ".webm";
    else if (mime.includes("quicktime") || mime.includes("mov")) ext = ".mov";
    else if (mime.includes("matroska") || mime.includes("mkv")) ext = ".mkv";
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

/**
 * Instantly imports a Google Drive video into Code-UP's Native Security pipeline
 * without saving to disk (Zero VPS Disk Usage).
 * Video is securely streamed on-demand to authorized students via Service Account.
 */
export async function importGoogleDriveVideo(
  fileId: string,
  options?: { maxSizeBytes?: number }
): Promise<GoogleDriveDownloadResult & { isCloudStream: boolean; sizeFormatted: string }> {
  // 1. Verify metadata & access with Google Drive API v3
  const metadata = await getGoogleDriveFileMetadata(fileId);

  // Configurable size limit: Default 6 GB (to easily handle 3GB & 5GB teacher videos)
  const envMaxGb = Number(process.env.GOOGLE_DRIVE_MAX_FILE_SIZE_GB) || 6;
  const maxBytes = options?.maxSizeBytes || envMaxGb * 1024 * 1024 * 1024;
  const fileSize = Number(metadata.size) || 0;
  if (fileSize > maxBytes) {
    const sizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
    const maxGB = (maxBytes / (1024 * 1024 * 1024)).toFixed(0);
    throw new Error(`حجم الفيديو (${sizeGB} جيجابايت) يتجاوز الحد الأقصى المسموح به (${maxGB} جيجابايت).`);
  }

  // 2. Validate MIME type & file extension
  const mime = (metadata.mimeType || "").toLowerCase();
  const originalName = metadata.name || "video.mp4";
  const ext = path.extname(originalName).toLowerCase();

  const isVideoMime =
    mime.startsWith("video/") ||
    mime === "application/octet-stream" ||
    mime === "application/x-matroska" ||
    mime === "application/mp4";

  const allowedExtensions = [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi", ".ts"];
  const hasValidExt = ext && allowedExtensions.includes(ext);

  if (!isVideoMime && !hasValidExt) {
    throw new Error(
      `نوع الملف (${mime || "غير معروف"}) ليس ملف فيديو صالحاً. يُسمح فقط بملفات الفيديو (MP4, WebM, MOV, MKV).`
    );
  }

  // Calculate duration in minutes if provided in metadata
  let durationMinutes = 0;
  if (metadata.videoMediaMetadata?.durationMillis) {
    const millis = Number(metadata.videoMediaMetadata.durationMillis);
    if (!isNaN(millis) && millis > 0) {
      durationMinutes = Math.ceil(millis / 60000);
    }
  }

  const cleanTitle = originalName.replace(/\.[^/.]+$/, "").trim() || "درس فيديو";
  const videoId = `gdrive_${fileId}`;

  const sizeFormatted =
    fileSize >= 1024 * 1024 * 1024
      ? `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} جيجابايت`
      : `${(fileSize / (1024 * 1024)).toFixed(1)} ميجابايت`;

  return {
    success: true,
    videoId,
    filename: videoId,
    title: cleanTitle,
    durationMinutes,
    sizeBytes: fileSize,
    sizeFormatted,
    mimeType: metadata.mimeType || "video/mp4",
    videoProvider: "alasly",
    isCloudStream: true,
  };
}

export async function streamGoogleDriveVideo(
  fileId: string,
  rangeHeader?: string | null
): Promise<Response> {
  let driveRes: Response | null = null;

  // 1. Primary path: Service Account authorized streaming
  try {
    const token = await getGoogleDriveAccessToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const res = await fetch(downloadUrl, {
      method: "GET",
      headers,
    });

    if (res.ok || res.status === 206) {
      driveRes = res;
    }
  } catch (err: any) {
    console.warn("[Google Drive Stream] Service Account stream fallback:", err?.message || err);
  }

  // 2. Secondary path: Direct public CDN stream fallback (if file has link sharing)
  if (!driveRes) {
    const publicEndpoints = [
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`,
      `https://docs.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`,
    ];

    for (const ep of publicEndpoints) {
      try {
        const epHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
        if (rangeHeader) {
          epHeaders["Range"] = rangeHeader;
        }

        const res = await fetch(ep, {
          method: "GET",
          headers: epHeaders,
          redirect: "follow",
        });

        if (res.ok || res.status === 206) {
          driveRes = res;
          break;
        }
      } catch {
        // continue to next endpoint
      }
    }
  }

  if (!driveRes || (!driveRes.ok && driveRes.status !== 206)) {
    const errText = driveRes ? await driveRes.text().catch(() => "") : "";
    throw new Error(`خطأ في تشغيل الفيديو من Google Drive: ${errText || "يرجى التأكد من صلاحيات الفيديو"}`);
  }

  const responseHeaders = new Headers();
  const forwardHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-duration",
  ];

  for (const h of forwardHeaders) {
    const val = driveRes.headers.get(h);
    if (val) responseHeaders.set(h, val);
  }

  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "video/mp4");
  }
  if (!responseHeaders.has("accept-ranges")) {
    responseHeaders.set("accept-ranges", "bytes");
  }
  responseHeaders.set("Cache-Control", "no-store, private");

  return new Response(driveRes.body, {
    status: driveRes.status,
    headers: responseHeaders,
  });
}
