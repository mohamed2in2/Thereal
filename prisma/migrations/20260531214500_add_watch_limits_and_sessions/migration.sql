ALTER TABLE "Course" ADD COLUMN "maxWatchCount" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Course" ADD COLUMN "homeworkUrl" TEXT;

CREATE TABLE "VideoWatchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "usedWatchSlot" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "VideoWatchSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VideoWatchSession_sessionToken_key" ON "VideoWatchSession"("sessionToken");
CREATE INDEX "VideoWatchSession_videoId_idx" ON "VideoWatchSession"("videoId");
CREATE INDEX "VideoWatchSession_studentId_idx" ON "VideoWatchSession"("studentId");
CREATE INDEX "VideoWatchSession_sessionToken_idx" ON "VideoWatchSession"("sessionToken");
