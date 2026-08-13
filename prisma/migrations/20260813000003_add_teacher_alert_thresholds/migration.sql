-- CreateTable
CREATE TABLE "TeacherAlertThresholds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "behindPacePercent" REAL NOT NULL DEFAULT 80,
    "behindPeerPercent" REAL NOT NULL DEFAULT 50,
    "decliningDropPoints" REAL NOT NULL DEFAULT 15,
    "decliningWindow" INTEGER NOT NULL DEFAULT 3,
    "inactiveDays" INTEGER NOT NULL DEFAULT 7,
    "strugglingWrongPercent" REAL NOT NULL DEFAULT 40,
    "strugglingMinAttempts" INTEGER NOT NULL DEFAULT 5,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAlertThresholds_version_key" ON "TeacherAlertThresholds"("version");

-- CreateIndex
CREATE INDEX "TeacherAlertThresholds_isActive_idx" ON "TeacherAlertThresholds"("isActive");

-- Seed version 1 with the agreed defaults so the first read never has to invent
-- values: 80% of expected pace, 15-point decline, 7 days inactive, 40% wrong.
INSERT INTO "TeacherAlertThresholds" ("id", "version", "isActive", "note")
VALUES ('tat_v1_default', 1, true, 'Initial defaults agreed 2026-08-13');
