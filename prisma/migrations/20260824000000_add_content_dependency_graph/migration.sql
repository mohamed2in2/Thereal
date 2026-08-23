-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'HOMEWORK', 'QUIZ', 'EXAM', 'SOLUTION_VIDEO', 'PDF');

-- CreateEnum
CREATE TYPE "ContentProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPrerequisite" (
    "id" TEXT NOT NULL,
    "targetContentId" TEXT NOT NULL,
    "prerequisiteContentId" TEXT NOT NULL,
    "requiredStatus" "ContentProgressStatus" NOT NULL DEFAULT 'COMPLETED',
    "minScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentContentProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" "ContentProgressStatus" NOT NULL DEFAULT 'UNLOCKED',
    "score" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentContentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_type_sourceId_key" ON "ContentItem"("type", "sourceId");
CREATE INDEX "ContentItem_sourceId_idx" ON "ContentItem"("sourceId");
CREATE UNIQUE INDEX "ContentPrerequisite_targetContentId_prerequisiteContentId_key" ON "ContentPrerequisite"("targetContentId", "prerequisiteContentId");
CREATE INDEX "ContentPrerequisite_prerequisiteContentId_idx" ON "ContentPrerequisite"("prerequisiteContentId");
CREATE UNIQUE INDEX "StudentContentProgress_studentId_contentId_key" ON "StudentContentProgress"("studentId", "contentId");
CREATE INDEX "StudentContentProgress_studentId_status_idx" ON "StudentContentProgress"("studentId", "status");
CREATE INDEX "StudentContentProgress_contentId_idx" ON "StudentContentProgress"("contentId");

-- AddForeignKey
ALTER TABLE "ContentPrerequisite" ADD CONSTRAINT "ContentPrerequisite_targetContentId_fkey" FOREIGN KEY ("targetContentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPrerequisite" ADD CONSTRAINT "ContentPrerequisite_prerequisiteContentId_fkey" FOREIGN KEY ("prerequisiteContentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentContentProgress" ADD CONSTRAINT "StudentContentProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentContentProgress" ADD CONSTRAINT "StudentContentProgress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
