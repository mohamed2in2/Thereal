-- ============================================================================
-- Code-UP — prod Postgres schema sync for V10.05–V10.08
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS / guarded FK).
-- Run on an ALLOWLISTED host (the Linux server, or the DigitalOcean DB console):
--    psql "$DATABASE_URL" -f scripts/prod-schema-sync.sql
-- Or paste into the DigitalOcean database console.
-- NOTE: `npx prisma db push` (from the server) does the same thing and is
-- authoritative — this script is the manual alternative for the named fields.
-- ============================================================================

-- ── Scheduled unlock (V10.05–V10.07) ───────────────────────────────────────
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);
ALTER TABLE "Video"  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);

-- ── Resume playback (V10.05/V10.07) ────────────────────────────────────────
ALTER TABLE "Progress" ADD COLUMN IF NOT EXISTS "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Progress" ADD COLUMN IF NOT EXISTS "positionUpdatedAt"   TIMESTAMP(3);

-- ── Per-video watch limits / free videos / multi-provider (used by playback) ─
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "maxWatchesPerUser" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "isFree"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "durationMinutes"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "videoProvider"     TEXT    NOT NULL DEFAULT 'vdocipher';
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "providerVideoId"   TEXT    NOT NULL DEFAULT '';

-- ── Course sequential access + watch count (learn page) ─────────────────────
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "sequentialAccess" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "maxWatchCount"    INTEGER NOT NULL DEFAULT 3;

-- ── Device lock (login + playback enforcement) ──────────────────────────────
CREATE TABLE IF NOT EXISTS "Device" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "deviceId"   TEXT NOT NULL,
  "label"      TEXT,
  "userAgent"  TEXT,
  "ipAddress"  TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Device_userId_deviceId_key" ON "Device"("userId", "deviceId");
CREATE INDEX IF NOT EXISTS "Device_userId_idx" ON "Device"("userId");
DO $$ BEGIN
  ALTER TABLE "Device"
    ADD CONSTRAINT "Device_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── App settings (configurable max-devices / teacher grace days) ────────────
CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
