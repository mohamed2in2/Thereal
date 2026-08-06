/*
  Warnings:

  - You are about to drop the column `quizTimeLimitMinutes` on the `Course` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "DailyStudyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "planDate" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastUpdatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyStudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "totalEnrollments" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "averageScore" REAL NOT NULL DEFAULT 0,
    "lastUpdatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClientError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "userRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "actions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rating" INTEGER,
    "content" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "aiInsights" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeedback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentFeedback_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeAdjustmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "currentScore" REAL NOT NULL,
    "requestedScore" REAL,
    "reason" TEXT NOT NULL,
    "aiAnalysis" TEXT,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "teacherId" TEXT,
    "teacherNotes" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeAdjustmentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeAdjustmentRequest_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeAdjustmentRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeAdjustmentRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIStudentInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "dataSnapshot" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isActioned" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIStudentInsight_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiHandled" BOOLEAN NOT NULL DEFAULT false,
    "aiResponse" TEXT,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "educationalStage" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" REAL,
    "discountPercent" REAL,
    "discountExpiresAt" DATETIME,
    "contactPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("createdAt", "description", "educationalStage", "id", "subject", "teacherId", "thumbnailUrl", "title", "updatedAt") SELECT "createdAt", "description", "educationalStage", "id", "subject", "teacherId", "thumbnailUrl", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");
CREATE INDEX "Course_educationalStage_idx" ON "Course"("educationalStage");
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "folderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("createdAt", "folderId", "id", "title") SELECT "createdAt", "folderId", "id", "title" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE INDEX "Quiz_folderId_idx" ON "Quiz"("folderId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "phone" TEXT,
    "parentPhone" TEXT,
    "age" INTEGER,
    "educationalStage" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("age", "createdAt", "educationalStage", "email", "id", "name", "password", "phone", "role", "updatedAt") SELECT "age", "createdAt", "educationalStage", "email", "id", "name", "password", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_educationalStage_idx" ON "User"("educationalStage");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyStudyPlan_studentId_idx" ON "DailyStudyPlan"("studentId");

-- CreateIndex
CREATE INDEX "DailyStudyPlan_planDate_idx" ON "DailyStudyPlan"("planDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStudyPlan_studentId_planDate_key" ON "DailyStudyPlan"("studentId", "planDate");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAnalytics_courseId_key" ON "CourseAnalytics"("courseId");

-- CreateIndex
CREATE INDEX "ClientError_type_idx" ON "ClientError"("type");

-- CreateIndex
CREATE INDEX "ClientError_createdAt_idx" ON "ClientError"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_adminId_idx" ON "ActivityLog"("adminId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_studentId_idx" ON "AIConversation"("studentId");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "StudentFeedback_studentId_idx" ON "StudentFeedback"("studentId");

-- CreateIndex
CREATE INDEX "StudentFeedback_courseId_idx" ON "StudentFeedback"("courseId");

-- CreateIndex
CREATE INDEX "StudentFeedback_teacherId_idx" ON "StudentFeedback"("teacherId");

-- CreateIndex
CREATE INDEX "StudentFeedback_type_idx" ON "StudentFeedback"("type");

-- CreateIndex
CREATE INDEX "StudentFeedback_createdAt_idx" ON "StudentFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "GradeAdjustmentRequest_studentId_idx" ON "GradeAdjustmentRequest"("studentId");

-- CreateIndex
CREATE INDEX "GradeAdjustmentRequest_courseId_idx" ON "GradeAdjustmentRequest"("courseId");

-- CreateIndex
CREATE INDEX "GradeAdjustmentRequest_teacherId_idx" ON "GradeAdjustmentRequest"("teacherId");

-- CreateIndex
CREATE INDEX "GradeAdjustmentRequest_status_idx" ON "GradeAdjustmentRequest"("status");

-- CreateIndex
CREATE INDEX "GradeAdjustmentRequest_createdAt_idx" ON "GradeAdjustmentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AIStudentInsight_studentId_idx" ON "AIStudentInsight"("studentId");

-- CreateIndex
CREATE INDEX "AIStudentInsight_type_idx" ON "AIStudentInsight"("type");

-- CreateIndex
CREATE INDEX "AIStudentInsight_category_idx" ON "AIStudentInsight"("category");

-- CreateIndex
CREATE INDEX "AIStudentInsight_createdAt_idx" ON "AIStudentInsight"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_studentId_idx" ON "SupportTicket"("studentId");

-- CreateIndex
CREATE INDEX "SupportTicket_courseId_idx" ON "SupportTicket"("courseId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "AccessCode_courseId_idx" ON "AccessCode"("courseId");

-- CreateIndex
CREATE INDEX "AccessCode_studentId_idx" ON "AccessCode"("studentId");

-- CreateIndex
CREATE INDEX "AccessCode_isActive_idx" ON "AccessCode"("isActive");

-- CreateIndex
CREATE INDEX "Folder_courseId_idx" ON "Folder"("courseId");

-- CreateIndex
CREATE INDEX "Progress_studentId_idx" ON "Progress"("studentId");

-- CreateIndex
CREATE INDEX "Progress_videoId_idx" ON "Progress"("videoId");

-- CreateIndex
CREATE INDEX "QuizResult_studentId_idx" ON "QuizResult"("studentId");

-- CreateIndex
CREATE INDEX "QuizResult_quizId_idx" ON "QuizResult"("quizId");

-- CreateIndex
CREATE INDEX "Video_folderId_idx" ON "Video"("folderId");
