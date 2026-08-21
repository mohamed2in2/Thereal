-- Per-student, per-video grants of extra views after the watch limit is hit.
CREATE TABLE "VideoViewRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "grantedViews" INTEGER NOT NULL DEFAULT 0,
    "teacherId" TEXT,
    "teacherNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoViewRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoViewRequest_studentId_idx" ON "VideoViewRequest"("studentId");
CREATE INDEX "VideoViewRequest_videoId_idx" ON "VideoViewRequest"("videoId");
CREATE INDEX "VideoViewRequest_teacherId_idx" ON "VideoViewRequest"("teacherId");
CREATE INDEX "VideoViewRequest_status_idx" ON "VideoViewRequest"("status");
CREATE INDEX "VideoViewRequest_createdAt_idx" ON "VideoViewRequest"("createdAt");
CREATE INDEX "VideoViewRequest_studentId_videoId_idx" ON "VideoViewRequest"("studentId", "videoId");

-- At most one OPEN request per student per video. A partial unique index is used
-- rather than a plain composite unique so that approved and rejected rows can
-- accumulate as history (and so repeat grants stay possible), while parallel
-- submissions still cannot create two pending rows.
CREATE UNIQUE INDEX "VideoViewRequest_one_pending_per_student_video"
    ON "VideoViewRequest"("studentId", "videoId")
    WHERE "status" = 'pending';

ALTER TABLE "VideoViewRequest" ADD CONSTRAINT "VideoViewRequest_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoViewRequest" ADD CONSTRAINT "VideoViewRequest_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoViewRequest" ADD CONSTRAINT "VideoViewRequest_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
