#!/usr/bin/env node

/**
 * Code-UP Axinom Multi-DRM Video Packaging & Encryption Utility.
 * Encrypts raw MP4 videos into Common Encryption (CENC) DASH/HLS segments with Widevine & PlayReady PSSH,
 * and safely deletes the original raw MP4 only after verifying non-empty encrypted outputs.
 *
 * Usage:
 *   node scripts/encrypt-video.js <input-video.mp4> <assetId> [--delete-raw]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DRM_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'drm');
const DRM_KEYS_DIR = path.resolve(process.cwd(), 'uploads', 'drm-keys');

function generateDrmKeys() {
  const keyId = crypto.randomBytes(16).toString('hex');
  const key = crypto.randomBytes(16).toString('hex');
  return { keyId, key };
}

function findPackagerBinary() {
  const customPath = process.env.SHAKA_PACKAGER_PATH;
  if (customPath && fs.existsSync(customPath)) return customPath;

  const standardNames = process.platform === 'win32'
    ? ['packager.exe', 'packager-win-x64.exe', 'packager']
    : ['packager', 'packager-linux-x64', 'shaka-packager'];

  for (const name of standardNames) {
    try {
      const check = spawnSync(name, ['--version'], { stdio: 'ignore' });
      if (check.status === 0 || check.error === undefined) {
        return name;
      }
    } catch {
      // not in path
    }
  }

  // Check local project binary folder
  const localBin = path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'packager.exe' : 'packager');
  if (fs.existsSync(localBin)) return localBin;

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Code-UP DRM Packager');
    console.log('Usage: node scripts/encrypt-video.js <input.mp4> <assetId> [--delete-raw]');
    process.exit(1);
  }

  const inputFile = path.resolve(args[0]);
  const assetId = args[1].trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const deleteRaw = args.includes('--delete-raw');

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file does not exist: ${inputFile}`);
    process.exit(1);
  }

  const outputDir = path.join(DRM_OUTPUT_DIR, assetId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!fs.existsSync(DRM_KEYS_DIR)) {
    fs.mkdirSync(DRM_KEYS_DIR, { recursive: true });
  }

  const packagerBin = findPackagerBinary();
  const { keyId, key } = generateDrmKeys();

  console.log(`\n========================================`);
  console.log(` Code-UP Hardware Multi-DRM Packaging `);
  console.log(`========================================`);
  console.log(`Input File:  ${inputFile}`);
  console.log(`Asset ID:    ${assetId}`);
  console.log(`Output Dir:  ${outputDir}`);
  console.log(`DRM Key ID:  ${keyId}`);
  console.log(`DRM Key:     ${key}`);

  if (!packagerBin) {
    console.warn(`\n[Notice] Shaka Packager CLI not found in PATH.`);
    console.log(`To install Shaka Packager on Linux (t3.medium):`);
    console.log(`  sudo wget https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64 -O /usr/local/bin/packager && sudo chmod +x /usr/local/bin/packager`);
    console.log(`\nSaving DRM asset metadata for when packager is invoked...`);

    const meta = {
      assetId,
      keyId,
      key,
      status: 'pending_packaging',
      source: inputFile,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(DRM_KEYS_DIR, `${assetId}.json`), JSON.stringify(meta, null, 2));
    console.log(`Saved private metadata to ${path.join(DRM_KEYS_DIR, `${assetId}.json`)}`);
    return;
  }

  console.log(`\nEncrypting and packaging DASH + HLS with Shaka Packager (Widevine + PlayReady)...`);

  const manifestPath = path.join(outputDir, 'manifest.mpd');
  const hlsPath = path.join(outputDir, 'master.m3u8');
  const videoOut = path.join(outputDir, 'video.mp4');
  const audioOut = path.join(outputDir, 'audio.mp4');

  const packagerArgs = [
    `in=${inputFile},stream=video,output=${videoOut}`,
    `in=${inputFile},stream=audio,output=${audioOut}`,
    '--enable_raw_key_encryption',
    `--keys=label=:key_id=${keyId}:key=${key}`,
    '--protection_systems=Widevine,PlayReady',
    '--protection_scheme=cenc',
    `--mpd_output=${manifestPath}`,
    `--hls_master_playlist_output=${hlsPath}`,
  ];

  const result = spawnSync(packagerBin, packagerArgs, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\nPackaging failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }

  // Verify that required encrypted outputs exist and are non-empty
  const manifestExists = fs.existsSync(manifestPath) && fs.statSync(manifestPath).size > 0;
  const videoExists = fs.existsSync(videoOut) && fs.statSync(videoOut).size > 0;

  if (!manifestExists || !videoExists) {
    console.error(`\nPackaging verification failed: generated outputs are missing or empty.`);
    process.exit(1);
  }

  // Save private metadata securely outside served directory
  const meta = {
    assetId,
    keyId,
    key,
    manifest: `/api/videos/drm/${assetId}/manifest.mpd`,
    hlsMaster: `/api/videos/drm/${assetId}/master.m3u8`,
    status: 'ready',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(DRM_KEYS_DIR, `${assetId}.json`), JSON.stringify(meta, null, 2));

  console.log(`\nEncrypted DASH Manifest: ${manifestPath}`);
  console.log(`Encrypted HLS Playlist:  ${hlsPath}`);

  // Storage optimization: delete original raw MP4 only if requested and verified
  if (deleteRaw) {
    try {
      fs.unlinkSync(inputFile);
      console.log(`Cleaned up raw MP4 file to preserve server storage.`);
    } catch (e) {
      console.warn(`Could not delete raw MP4: ${e.message}`);
    }
  } else {
    console.log(`Original MP4 preserved at: ${inputFile} (Pass --delete-raw to remove)`);
  }

  console.log(`\nSuccess! Video is now 100% DRM-protected and ready for playback.\n`);
}

main().catch((err) => {
  console.error('Fatal packaging error:', err);
  process.exit(1);
});
