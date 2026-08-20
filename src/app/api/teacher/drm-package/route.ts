import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "videos");
const DRM_OUTPUT_DIR = path.resolve(process.cwd(), "uploads", "drm");
const DRM_KEYS_DIR = path.resolve(process.cwd(), "uploads", "drm-keys");

function findPackagerBinary(): string | null {
  const customPath = process.env.SHAKA_PACKAGER_PATH;
  if (customPath && fs.existsSync(customPath)) return customPath;

  const standardNames =
    process.platform === "win32"
      ? ["packager.exe", "packager-win-x64.exe", "packager"]
      : ["/usr/local/bin/packager", "/usr/bin/packager", "packager", "packager-linux-x64", "shaka-packager"];

  for (const name of standardNames) {
    try {
      const check = spawnSync(name, ["--version"], { stdio: "ignore" });
      if (check.status === 0 || check.error === undefined) {
        return name;
      }
    } catch {
      // not available
    }
  }

  const localBin = path.join(process.cwd(), "bin", process.platform === "win32" ? "packager.exe" : "packager");
  if (fs.existsSync(localBin)) return localBin;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "teacher" && session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawVideoId = String(body.videoId || body.assetId || "").trim();
    if (!rawVideoId) {
      return NextResponse.json({ error: "معرّف الفيديو (videoId) مطلوب للتشفير" }, { status: 400 });
    }

    const safeFilename = path.basename(rawVideoId);
    let sourcePath = path.join(UPLOADS_DIR, safeFilename);

    // If file does not exist directly, check without prefix
    if (!fs.existsSync(sourcePath)) {
      const possibleFiles = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
      const matched = possibleFiles.find((f) => f.includes(safeFilename) || safeFilename.includes(f));
      if (matched) {
        sourcePath = path.join(UPLOADS_DIR, matched);
      }
    }

    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json(
        { error: `ملف الفيديو غير موجود على السيرفر لتشفيره عتادياً: ${safeFilename}` },
        { status: 404 }
      );
    }

    const packagerBin = findPackagerBinary();
    if (!packagerBin) {
      return NextResponse.json(
        {
          error:
            "أداة Shaka Packager غير مثبتة على السيرفر. قم بتشغيل الأمر التالي على السيرفر:\nsudo wget https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64 -O /usr/local/bin/packager && sudo chmod +x /usr/local/bin/packager",
        },
        { status: 500 }
      );
    }

    const assetId = body.assetId || `cenc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const safeAssetId = assetId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const outputDir = path.join(DRM_OUTPUT_DIR, safeAssetId);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(DRM_KEYS_DIR)) fs.mkdirSync(DRM_KEYS_DIR, { recursive: true });

    const keyId = crypto.randomBytes(16).toString("hex");
    const key = crypto.randomBytes(16).toString("hex");

    const manifestPath = path.join(outputDir, "manifest.mpd");
    const videoOut = path.join(outputDir, "video.mp4");
    const audioOut = path.join(outputDir, "audio.mp4");

    const packagerArgs = [
      `in=${sourcePath},stream=video,output=${videoOut}`,
      `in=${sourcePath},stream=audio,output=${audioOut}`,
      "--enable_raw_key_encryption",
      `--keys=label=:key_id=${keyId}:key=${key}`,
      "--protection_systems=Widevine,PlayReady",
      "--protection_scheme=cenc",
      `--mpd_output=${manifestPath}`,
    ];

    const result = spawnSync(packagerBin, packagerArgs, { stdio: "inherit" });
    if (result.status !== 0) {
      return NextResponse.json(
        { error: `فشلت عملية التشفير العتادي Shaka Packager (رمز الخطأ: ${result.status})` },
        { status: 500 }
      );
    }

    const keyMeta = {
      assetId: safeAssetId,
      keyId,
      key,
      source: sourcePath,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(DRM_KEYS_DIR, `${safeAssetId}.json`), JSON.stringify(keyMeta, null, 2));

    return NextResponse.json({
      success: true,
      assetId: safeAssetId,
      manifestUrl: `/api/videos/drm/${safeAssetId}/manifest.mpd`,
      message: "تم تشفير الفيديو عتادياً بنظام CENC Widevine + PlayReady بنجاح!",
    });
  } catch (error: any) {
    console.error("[drm-package] error:", error);
    return NextResponse.json({ error: error.message || "حدث خطأ أثناء تشفير الفيديو" }, { status: 500 });
  }
}
