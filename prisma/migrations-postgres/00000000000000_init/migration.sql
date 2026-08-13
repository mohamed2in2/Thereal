-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ParentVerificationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
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
    "deletedAt" TIMESTAMP(3),
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 0,
    "pointsUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TIMESTAMP(3),
    "streakFreezes" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredById" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iqData" TEXT,
    "overallIQ" INTEGER NOT NULL DEFAULT 1000,
    "promoProgramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "promoCode" TEXT,
    "promoCodeCreatedAt" TIMESTAMP(3),
    "referredByTeacherId" TEXT,
    "parentVerified" BOOLEAN NOT NULL DEFAULT false,
    "parentVerifiedAt" TIMESTAMP(3),
    "parentVerificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "accountMode" TEXT NOT NULL DEFAULT 'NORMAL',
    "testerCapabilities" TEXT,
    "testerNotes" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "educationalStage" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION,
    "discountPercent" DOUBLE PRECISION,
    "discountExpiresAt" TIMESTAMP(3),
    "contactPhone" TEXT,
    "maxWatchCount" INTEGER NOT NULL DEFAULT 3,
    "sequentialAccess" BOOLEAN NOT NULL DEFAULT true,
    "enableWatchedButton" BOOLEAN NOT NULL DEFAULT false,
    "homeworkUrl" TEXT,
    "allowDirectInstall" BOOLEAN NOT NULL DEFAULT false,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "models" TEXT NOT NULL,
    "apiKeyEnc" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isBackup" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkDeletionRequest" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "instant" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "affectedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "bannerUrl" TEXT,
    "navColor" TEXT DEFAULT '#0b0f19',
    "accentColor" TEXT DEFAULT '#6366f1',
    "socials" TEXT,
    "featuredCourseId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "priceMonthly" DOUBLE PRECISION DEFAULT 180,
    "priceTermly" DOUBLE PRECISION DEFAULT 750,
    "priceYearly" DOUBLE PRECISION DEFAULT 1200,
    "discountMonthly" DOUBLE PRECISION,
    "discountTermly" DOUBLE PRECISION,
    "discountYearly" DOUBLE PRECISION,
    "stagePricing" TEXT,
    "courseStartDate" TIMESTAMP(3),
    "bookingContactUrl" TEXT,
    "enableLanguagesTrack" BOOLEAN NOT NULL DEFAULT true,
    "priceLanguagesMonthly" DOUBLE PRECISION DEFAULT 0,
    "priceLanguagesTermly" DOUBLE PRECISION DEFAULT 0,
    "priceLanguagesYearly" DOUBLE PRECISION DEFAULT 0,
    "paymentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "courseId" TEXT NOT NULL,
    "publishAt" TIMESTAMP(3),
    "price" DOUBLE PRECISION DEFAULT 0,
    "isPurchasable" BOOLEAN NOT NULL DEFAULT true,
    "homeworkUrl" TEXT,
    "monthIndex" INTEGER,
    "monthIndexIsManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vdoCipherId" TEXT NOT NULL DEFAULT '',
    "videoProvider" TEXT NOT NULL DEFAULT 'vdocipher',
    "providerVideoId" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxWatchesPerUser" INTEGER NOT NULL DEFAULT 3,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "folderId" TEXT NOT NULL,
    "price" DOUBLE PRECISION DEFAULT 0,
    "lessonIndexInMonth" INTEGER,
    "lessonIndexIsManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoWatchSession" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "usedWatchSlot" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VideoWatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "retakeCooldownHours" INTEGER NOT NULL DEFAULT 0,
    "folderId" TEXT,
    "planLessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'mcq',
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL DEFAULT '',
    "optionB" TEXT NOT NULL DEFAULT '',
    "optionC" TEXT NOT NULL DEFAULT '',
    "optionD" TEXT NOT NULL DEFAULT '',
    "correctAnswer" TEXT NOT NULL DEFAULT 'A',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "folderId" TEXT,
    "videoId" TEXT,
    "studentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessType" TEXT NOT NULL DEFAULT 'TERM',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" TIMESTAMP(3),
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "positionUpdatedAt" TIMESTAMP(3),
    "watchedSecondsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalQ" INTEGER NOT NULL,
    "allowRetake" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'mcq',
    "selectedAnswer" TEXT,
    "essayAnswer" TEXT,
    "imageUrl" TEXT,
    "correctAnswer" TEXT NOT NULL DEFAULT '',
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "teacherReply" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL DEFAULT '',
    "optionB" TEXT NOT NULL DEFAULT '',
    "optionC" TEXT NOT NULL DEFAULT '',
    "optionD" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStudyPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAnalytics" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "totalEnrollments" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientError" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "userRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "actions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeedback" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "courseId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL,
    "requestedScore" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "aiAnalysis" TEXT,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "teacherId" TEXT,
    "teacherNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIStudentInsight" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "dataSnapshot" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isActioned" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIStudentInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "educationalStage" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExamResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalQ" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoQuestion" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "triggerSecond" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'pause',
    "questionType" TEXT NOT NULL DEFAULT 'mcq',
    "questionText" TEXT NOT NULL,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctOption" TEXT,
    "explanation" TEXT,
    "refireOnRewatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoQuestionResponse" (
    "id" TEXT NOT NULL,
    "videoQuestionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "essayAnswer" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "teacherReply" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "answeredAtSecond" INTEGER NOT NULL,
    "watchSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoQuestionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubscription" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "planLabel" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "educationalStage" TEXT,
    "languageTrack" TEXT DEFAULT 'arabic',
    "studentName" TEXT,
    "studentPhone" TEXT,
    "parentPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PLATFORM_WIDE',
    "targetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxTotalUses" INTEGER,
    "maxUsesPerStudent" INTEGER NOT NULL DEFAULT 1,
    "allowedPaymentMethods" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCodeUsage" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purchaseType" TEXT NOT NULL,
    "purchaseTargetId" TEXT NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCodeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "courseId" TEXT,
    "folderId" TEXT,
    "videoId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'link',
    "linkUrl" TEXT,
    "expectedOutput" TEXT,
    "codeTemplate" TEXT,
    "codeLanguage" TEXT DEFAULT 'python',
    "allowedFileTypes" TEXT,
    "dueAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkQuestion" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeworkQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" TEXT,
    "score" DOUBLE PRECISION,
    "totalQ" INTEGER,
    "submittedOutput" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "verdict" TEXT,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderPurchase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoPurchase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardCache" (
    "key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "educationalStage" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "discountPrice" DOUBLE PRECISION,
    "discountExpiresAt" TIMESTAMP(3),
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gradingAIEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLesson" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "gatesNextLesson" BOOLEAN NOT NULL DEFAULT true,
    "requiresQuiz" BOOLEAN NOT NULL DEFAULT false,
    "requiresHomework" BOOLEAN NOT NULL DEFAULT false,
    "hasProject" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLessonSource" (
    "id" TEXT NOT NULL,
    "planLessonId" TEXT NOT NULL,
    "videoId" TEXT,
    "teacherId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanLessonSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCourseLink" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "folderId" TEXT,
    "startIndex" INTEGER,
    "endIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCourseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanHomework" (
    "id" TEXT NOT NULL,
    "planLessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanHomework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanHomeworkSubmission" (
    "id" TEXT NOT NULL,
    "planHomeworkId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "PlanHomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAccessCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEnrollment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pricePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "planLessonId" TEXT NOT NULL,
    "chosenSourceId" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "quizPassed" BOOLEAN NOT NULL DEFAULT false,
    "quizScore" DOUBLE PRECISION,
    "homeworkPassed" BOOLEAN NOT NULL DEFAULT false,
    "projectPassed" BOOLEAN,
    "projectGrade" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAuditLog" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanProjectSubmission" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planLessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "grade" DOUBLE PRECISION,
    "feedback" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "PlanProjectSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAIChatMessage" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAIChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedPlanContent" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmatchedPlanContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherReferralAttribution" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purchaseType" TEXT NOT NULL,
    "courseId" TEXT,
    "folderId" TEXT,
    "videoId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promoCodeUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerificationChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "method" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpQuota" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 250,
    "used" INTEGER NOT NULL DEFAULT 0,
    "signupUsed" INTEGER NOT NULL DEFAULT 0,
    "forgotPasswordUsed" INTEGER NOT NULL DEFAULT 0,
    "purchaseUsed" INTEGER NOT NULL DEFAULT 0,
    "phoneChangeUsed" INTEGER NOT NULL DEFAULT 0,
    "codeRedemptionUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OtpQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "invitedId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qualifyingPurchaseId" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCodeLog" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userId" TEXT,
    "attemptHash" TEXT NOT NULL,
    "first4Characters" TEXT NOT NULL,
    "codeLength" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCodeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "device" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "deliveryMode" TEXT NOT NULL DEFAULT 'baileys_primary',
    "baileysOtpTemplate" TEXT,
    "autoSendParentPortal" BOOLEAN NOT NULL DEFAULT true,
    "requireParentVerification" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "deliveryTimeMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConfigLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConfigLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDailyCounter" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "otpCount" INTEGER NOT NULL DEFAULT 0,
    "parentCount" INTEGER NOT NULL DEFAULT 0,
    "authCount" INTEGER NOT NULL DEFAULT 0,
    "utilityCount" INTEGER NOT NULL DEFAULT 0,
    "marketingCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppDailyCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentToken" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "ParentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedByIp" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "parentPhoneSnapshot" TEXT,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentVerificationEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "phone" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAccessLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityViolation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "videoId" TEXT,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fulfillmentSource" TEXT NOT NULL DEFAULT 'PURCHASE',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesterActivityLog" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetTitle" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_promoCode_key" ON "User"("promoCode");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_educationalStage_idx" ON "User"("educationalStage");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "User_promoCode_idx" ON "User"("promoCode");

-- CreateIndex
CREATE INDEX "User_isDemo_idx" ON "User"("isDemo");

-- CreateIndex
CREATE INDEX "User_accountMode_idx" ON "User"("accountMode");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Course_educationalStage_idx" ON "Course"("educationalStage");

-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_slug_key" ON "AIProvider"("slug");

-- CreateIndex
CREATE INDEX "BulkDeletionRequest_status_executeAt_idx" ON "BulkDeletionRequest"("status", "executeAt");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceId_key" ON "Device"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_teacherId_key" ON "TeacherProfile"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_slug_key" ON "TeacherProfile"("slug");

-- CreateIndex
CREATE INDEX "TeacherProfile_slug_idx" ON "TeacherProfile"("slug");

-- CreateIndex
CREATE INDEX "Folder_courseId_idx" ON "Folder"("courseId");

-- CreateIndex
CREATE INDEX "Video_folderId_idx" ON "Video"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoWatchSession_sessionToken_key" ON "VideoWatchSession"("sessionToken");

-- CreateIndex
CREATE INDEX "VideoWatchSession_videoId_idx" ON "VideoWatchSession"("videoId");

-- CreateIndex
CREATE INDEX "VideoWatchSession_studentId_idx" ON "VideoWatchSession"("studentId");

-- CreateIndex
CREATE INDEX "VideoWatchSession_sessionToken_idx" ON "VideoWatchSession"("sessionToken");

-- CreateIndex
CREATE INDEX "Quiz_folderId_idx" ON "Quiz"("folderId");

-- CreateIndex
CREATE INDEX "Quiz_planLessonId_idx" ON "Quiz"("planLessonId");

-- CreateIndex
CREATE INDEX "Material_folderId_idx" ON "Material"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE INDEX "AccessCode_courseId_idx" ON "AccessCode"("courseId");

-- CreateIndex
CREATE INDEX "AccessCode_folderId_idx" ON "AccessCode"("folderId");

-- CreateIndex
CREATE INDEX "AccessCode_videoId_idx" ON "AccessCode"("videoId");

-- CreateIndex
CREATE INDEX "AccessCode_studentId_idx" ON "AccessCode"("studentId");

-- CreateIndex
CREATE INDEX "AccessCode_isActive_idx" ON "AccessCode"("isActive");

-- CreateIndex
CREATE INDEX "Progress_studentId_idx" ON "Progress"("studentId");

-- CreateIndex
CREATE INDEX "Progress_videoId_idx" ON "Progress"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_studentId_videoId_key" ON "Progress"("studentId", "videoId");

-- CreateIndex
CREATE INDEX "QuizResult_studentId_idx" ON "QuizResult"("studentId");

-- CreateIndex
CREATE INDEX "QuizResult_quizId_idx" ON "QuizResult"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizResult_studentId_quizId_key" ON "QuizResult"("studentId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAnswer_studentId_isCorrect_idx" ON "QuizAnswer"("studentId", "isCorrect");

-- CreateIndex
CREATE INDEX "QuizAnswer_quizId_idx" ON "QuizAnswer"("quizId");

-- CreateIndex
CREATE INDEX "QuizAnswer_resultId_idx" ON "QuizAnswer"("resultId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuizAnswer_status_idx" ON "QuizAnswer"("status");

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
CREATE INDEX "DailyExam_educationalStage_idx" ON "DailyExam"("educationalStage");

-- CreateIndex
CREATE INDEX "DailyExam_date_idx" ON "DailyExam"("date");

-- CreateIndex
CREATE INDEX "DailyExam_isActive_idx" ON "DailyExam"("isActive");

-- CreateIndex
CREATE INDEX "DailyExamQuestion_examId_idx" ON "DailyExamQuestion"("examId");

-- CreateIndex
CREATE INDEX "DailyExamResult_studentId_idx" ON "DailyExamResult"("studentId");

-- CreateIndex
CREATE INDEX "DailyExamResult_examId_idx" ON "DailyExamResult"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyExamResult_studentId_examId_key" ON "DailyExamResult"("studentId", "examId");

-- CreateIndex
CREATE INDEX "VideoQuestion_videoId_idx" ON "VideoQuestion"("videoId");

-- CreateIndex
CREATE INDEX "VideoQuestionResponse_videoQuestionId_idx" ON "VideoQuestionResponse"("videoQuestionId");

-- CreateIndex
CREATE INDEX "VideoQuestionResponse_studentId_idx" ON "VideoQuestionResponse"("studentId");

-- CreateIndex
CREATE INDEX "VideoQuestionResponse_status_idx" ON "VideoQuestionResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VideoQuestionResponse_videoQuestionId_studentId_watchSessio_key" ON "VideoQuestionResponse"("videoQuestionId", "studentId", "watchSessionId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "BalanceTransaction_userId_idx" ON "BalanceTransaction"("userId");

-- CreateIndex
CREATE INDEX "BalanceTransaction_type_idx" ON "BalanceTransaction"("type");

-- CreateIndex
CREATE INDEX "BalanceTransaction_createdAt_idx" ON "BalanceTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "TeacherSubscription_studentId_idx" ON "TeacherSubscription"("studentId");

-- CreateIndex
CREATE INDEX "TeacherSubscription_teacherId_idx" ON "TeacherSubscription"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherSubscription_status_idx" ON "TeacherSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubscription_studentId_teacherId_planType_key" ON "TeacherSubscription"("studentId", "teacherId", "planType");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCode_code_key" ON "MoneyCode"("code");

-- CreateIndex
CREATE INDEX "MoneyCode_code_idx" ON "MoneyCode"("code");

-- CreateIndex
CREATE INDEX "MoneyCode_isUsed_idx" ON "MoneyCode"("isUsed");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_code_idx" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_scope_targetId_idx" ON "DiscountCode"("scope", "targetId");

-- CreateIndex
CREATE INDEX "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

-- CreateIndex
CREATE INDEX "DiscountCodeUsage_discountCodeId_idx" ON "DiscountCodeUsage"("discountCodeId");

-- CreateIndex
CREATE INDEX "DiscountCodeUsage_studentId_idx" ON "DiscountCodeUsage"("studentId");

-- CreateIndex
CREATE INDEX "DiscountCodeUsage_purchaseType_purchaseTargetId_idx" ON "DiscountCodeUsage"("purchaseType", "purchaseTargetId");

-- CreateIndex
CREATE INDEX "Homework_teacherId_idx" ON "Homework"("teacherId");

-- CreateIndex
CREATE INDEX "Homework_courseId_idx" ON "Homework"("courseId");

-- CreateIndex
CREATE INDEX "Homework_folderId_idx" ON "Homework"("folderId");

-- CreateIndex
CREATE INDEX "Homework_videoId_idx" ON "Homework"("videoId");

-- CreateIndex
CREATE INDEX "Homework_isPublished_idx" ON "Homework"("isPublished");

-- CreateIndex
CREATE INDEX "HomeworkQuestion_homeworkId_idx" ON "HomeworkQuestion"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_status_idx" ON "HomeworkSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkReview_submissionId_key" ON "HomeworkReview"("submissionId");

-- CreateIndex
CREATE INDEX "HomeworkReview_teacherId_idx" ON "HomeworkReview"("teacherId");

-- CreateIndex
CREATE INDEX "FolderPurchase_studentId_idx" ON "FolderPurchase"("studentId");

-- CreateIndex
CREATE INDEX "FolderPurchase_folderId_idx" ON "FolderPurchase"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "FolderPurchase_studentId_folderId_key" ON "FolderPurchase"("studentId", "folderId");

-- CreateIndex
CREATE INDEX "VideoPurchase_studentId_idx" ON "VideoPurchase"("studentId");

-- CreateIndex
CREATE INDEX "VideoPurchase_videoId_idx" ON "VideoPurchase"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoPurchase_studentId_videoId_key" ON "VideoPurchase"("studentId", "videoId");

-- CreateIndex
CREATE INDEX "Plan_educationalStage_idx" ON "Plan"("educationalStage");

-- CreateIndex
CREATE INDEX "Plan_educationalStage_monthIndex_idx" ON "Plan"("educationalStage", "monthIndex");

-- CreateIndex
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

-- CreateIndex
CREATE INDEX "PlanLesson_planId_idx" ON "PlanLesson"("planId");

-- CreateIndex
CREATE INDEX "PlanLesson_planId_order_idx" ON "PlanLesson"("planId", "order");

-- CreateIndex
CREATE INDEX "PlanLessonSource_planLessonId_idx" ON "PlanLessonSource"("planLessonId");

-- CreateIndex
CREATE INDEX "PlanLessonSource_videoId_idx" ON "PlanLessonSource"("videoId");

-- CreateIndex
CREATE INDEX "PlanLessonSource_teacherId_idx" ON "PlanLessonSource"("teacherId");

-- CreateIndex
CREATE INDEX "PlanCourseLink_planId_idx" ON "PlanCourseLink"("planId");

-- CreateIndex
CREATE INDEX "PlanCourseLink_courseId_idx" ON "PlanCourseLink"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCourseLink_planId_courseId_folderId_key" ON "PlanCourseLink"("planId", "courseId", "folderId");

-- CreateIndex
CREATE INDEX "PlanHomework_planLessonId_idx" ON "PlanHomework"("planLessonId");

-- CreateIndex
CREATE INDEX "PlanHomeworkSubmission_planHomeworkId_idx" ON "PlanHomeworkSubmission"("planHomeworkId");

-- CreateIndex
CREATE INDEX "PlanHomeworkSubmission_studentId_idx" ON "PlanHomeworkSubmission"("studentId");

-- CreateIndex
CREATE INDEX "PlanHomeworkSubmission_status_idx" ON "PlanHomeworkSubmission"("status");

-- CreateIndex
CREATE INDEX "PlanHomeworkSubmission_enrollmentId_idx" ON "PlanHomeworkSubmission"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanHomeworkSubmission_planHomeworkId_studentId_key" ON "PlanHomeworkSubmission"("planHomeworkId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAccessCode_code_key" ON "PlanAccessCode"("code");

-- CreateIndex
CREATE INDEX "PlanAccessCode_planId_idx" ON "PlanAccessCode"("planId");

-- CreateIndex
CREATE INDEX "PlanAccessCode_code_idx" ON "PlanAccessCode"("code");

-- CreateIndex
CREATE INDEX "PlanEnrollment_planId_idx" ON "PlanEnrollment"("planId");

-- CreateIndex
CREATE INDEX "PlanEnrollment_studentId_idx" ON "PlanEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEnrollment_planId_studentId_key" ON "PlanEnrollment"("planId", "studentId");

-- CreateIndex
CREATE INDEX "PlanLessonProgress_enrollmentId_idx" ON "PlanLessonProgress"("enrollmentId");

-- CreateIndex
CREATE INDEX "PlanLessonProgress_planLessonId_idx" ON "PlanLessonProgress"("planLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLessonProgress_enrollmentId_planLessonId_key" ON "PlanLessonProgress"("enrollmentId", "planLessonId");

-- CreateIndex
CREATE INDEX "PlanAuditLog_planId_idx" ON "PlanAuditLog"("planId");

-- CreateIndex
CREATE INDEX "PlanAuditLog_planId_createdAt_idx" ON "PlanAuditLog"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanProjectSubmission_enrollmentId_idx" ON "PlanProjectSubmission"("enrollmentId");

-- CreateIndex
CREATE INDEX "PlanProjectSubmission_studentId_idx" ON "PlanProjectSubmission"("studentId");

-- CreateIndex
CREATE INDEX "PlanProjectSubmission_planLessonId_idx" ON "PlanProjectSubmission"("planLessonId");

-- CreateIndex
CREATE INDEX "PlanProjectSubmission_status_idx" ON "PlanProjectSubmission"("status");

-- CreateIndex
CREATE INDEX "PlanProjectSubmission_studentId_planLessonId_idx" ON "PlanProjectSubmission"("studentId", "planLessonId");

-- CreateIndex
CREATE INDEX "PlanAIChatMessage_enrollmentId_idx" ON "PlanAIChatMessage"("enrollmentId");

-- CreateIndex
CREATE INDEX "PlanAIChatMessage_studentId_idx" ON "PlanAIChatMessage"("studentId");

-- CreateIndex
CREATE INDEX "PlanAIChatMessage_enrollmentId_createdAt_idx" ON "PlanAIChatMessage"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "UnmatchedPlanContent_teacherId_idx" ON "UnmatchedPlanContent"("teacherId");

-- CreateIndex
CREATE INDEX "UnmatchedPlanContent_courseId_idx" ON "UnmatchedPlanContent"("courseId");

-- CreateIndex
CREATE INDEX "UnmatchedPlanContent_resolvedAt_idx" ON "UnmatchedPlanContent"("resolvedAt");

-- CreateIndex
CREATE INDEX "TeacherReferralAttribution_teacherId_idx" ON "TeacherReferralAttribution"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherReferralAttribution_studentId_idx" ON "TeacherReferralAttribution"("studentId");

-- CreateIndex
CREATE INDEX "TeacherReferralAttribution_createdAt_idx" ON "TeacherReferralAttribution"("createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationChallenge_phone_createdAt_idx" ON "PhoneVerificationChallenge"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationChallenge_expiresAt_idx" ON "PhoneVerificationChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtpQuota_date_key" ON "OtpQuota"("date");

-- CreateIndex
CREATE INDEX "OtpQueueItem_status_priority_queuedAt_idx" ON "OtpQueueItem"("status", "priority", "queuedAt");

-- CreateIndex
CREATE INDEX "OtpQueueItem_userId_idx" ON "OtpQueueItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_invitedId_key" ON "Referral"("invitedId");

-- CreateIndex
CREATE INDEX "Referral_inviterId_idx" ON "Referral"("inviterId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "AccessCodeLog_ip_createdAt_idx" ON "AccessCodeLog"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "AccessCodeLog_userId_createdAt_idx" ON "AccessCodeLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_ip_createdAt_idx" ON "AuditLog"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppLog_recipient_idx" ON "WhatsAppLog"("recipient");

-- CreateIndex
CREATE INDEX "WhatsAppLog_provider_createdAt_idx" ON "WhatsAppLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppLog_status_createdAt_idx" ON "WhatsAppLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppLog_messageType_idx" ON "WhatsAppLog"("messageType");

-- CreateIndex
CREATE INDEX "WhatsAppConfigLog_adminId_idx" ON "WhatsAppConfigLog"("adminId");

-- CreateIndex
CREATE INDEX "WhatsAppConfigLog_settingKey_createdAt_idx" ON "WhatsAppConfigLog"("settingKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDailyCounter_date_provider_key" ON "WhatsAppDailyCounter"("date", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ParentToken_studentId_key" ON "ParentToken"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentToken_tokenHash_key" ON "ParentToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentToken_status_idx" ON "ParentToken"("status");

-- CreateIndex
CREATE INDEX "ParentToken_tokenHash_idx" ON "ParentToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentToken_studentId_idx" ON "ParentToken"("studentId");

-- CreateIndex
CREATE INDEX "ParentVerificationEvent_studentId_createdAt_idx" ON "ParentVerificationEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessLog_studentId_accessedAt_idx" ON "ParentAccessLog"("studentId", "accessedAt");

-- CreateIndex
CREATE INDEX "ParentAccessLog_ip_idx" ON "ParentAccessLog"("ip");

-- CreateIndex
CREATE INDEX "SecurityViolation_studentId_idx" ON "SecurityViolation"("studentId");

-- CreateIndex
CREATE INDEX "SecurityViolation_type_idx" ON "SecurityViolation"("type");

-- CreateIndex
CREATE INDEX "SecurityViolation_createdAt_idx" ON "SecurityViolation"("createdAt");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_idx" ON "CourseEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_studentId_courseId_key" ON "CourseEnrollment"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "TesterActivityLog_testerId_idx" ON "TesterActivityLog"("testerId");

-- CreateIndex
CREATE INDEX "TesterActivityLog_action_idx" ON "TesterActivityLog"("action");

-- CreateIndex
CREATE INDEX "TesterActivityLog_createdAt_idx" ON "TesterActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByTeacherId_fkey" FOREIGN KEY ("referredByTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatchSession" ADD CONSTRAINT "VideoWatchSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatchSession" ADD CONSTRAINT "VideoWatchSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_planLessonId_fkey" FOREIGN KEY ("planLessonId") REFERENCES "PlanLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "QuizResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStudyPlan" ADD CONSTRAINT "DailyStudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAdjustmentRequest" ADD CONSTRAINT "GradeAdjustmentRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAdjustmentRequest" ADD CONSTRAINT "GradeAdjustmentRequest_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAdjustmentRequest" ADD CONSTRAINT "GradeAdjustmentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAdjustmentRequest" ADD CONSTRAINT "GradeAdjustmentRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIStudentInsight" ADD CONSTRAINT "AIStudentInsight_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyExamQuestion" ADD CONSTRAINT "DailyExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "DailyExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyExamResult" ADD CONSTRAINT "DailyExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "DailyExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyExamResult" ADD CONSTRAINT "DailyExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoQuestion" ADD CONSTRAINT "VideoQuestion_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoQuestionResponse" ADD CONSTRAINT "VideoQuestionResponse_videoQuestionId_fkey" FOREIGN KEY ("videoQuestionId") REFERENCES "VideoQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoQuestionResponse" ADD CONSTRAINT "VideoQuestionResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubscription" ADD CONSTRAINT "TeacherSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubscription" ADD CONSTRAINT "TeacherSubscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeUsage" ADD CONSTRAINT "DiscountCodeUsage_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeUsage" ADD CONSTRAINT "DiscountCodeUsage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkQuestion" ADD CONSTRAINT "HomeworkQuestion_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPurchase" ADD CONSTRAINT "FolderPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPurchase" ADD CONSTRAINT "FolderPurchase_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPurchase" ADD CONSTRAINT "VideoPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoPurchase" ADD CONSTRAINT "VideoPurchase_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLesson" ADD CONSTRAINT "PlanLesson_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLessonSource" ADD CONSTRAINT "PlanLessonSource_planLessonId_fkey" FOREIGN KEY ("planLessonId") REFERENCES "PlanLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLessonSource" ADD CONSTRAINT "PlanLessonSource_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCourseLink" ADD CONSTRAINT "PlanCourseLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCourseLink" ADD CONSTRAINT "PlanCourseLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHomework" ADD CONSTRAINT "PlanHomework_planLessonId_fkey" FOREIGN KEY ("planLessonId") REFERENCES "PlanLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHomeworkSubmission" ADD CONSTRAINT "PlanHomeworkSubmission_planHomeworkId_fkey" FOREIGN KEY ("planHomeworkId") REFERENCES "PlanHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHomeworkSubmission" ADD CONSTRAINT "PlanHomeworkSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PlanEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHomeworkSubmission" ADD CONSTRAINT "PlanHomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAccessCode" ADD CONSTRAINT "PlanAccessCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLessonProgress" ADD CONSTRAINT "PlanLessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PlanEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLessonProgress" ADD CONSTRAINT "PlanLessonProgress_planLessonId_fkey" FOREIGN KEY ("planLessonId") REFERENCES "PlanLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAuditLog" ADD CONSTRAINT "PlanAuditLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProjectSubmission" ADD CONSTRAINT "PlanProjectSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PlanEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProjectSubmission" ADD CONSTRAINT "PlanProjectSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAIChatMessage" ADD CONSTRAINT "PlanAIChatMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PlanEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAIChatMessage" ADD CONSTRAINT "PlanAIChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedPlanContent" ADD CONSTRAINT "UnmatchedPlanContent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReferralAttribution" ADD CONSTRAINT "TeacherReferralAttribution_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReferralAttribution" ADD CONSTRAINT "TeacherReferralAttribution_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpQueueItem" ADD CONSTRAINT "OtpQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_invitedId_fkey" FOREIGN KEY ("invitedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentToken" ADD CONSTRAINT "ParentToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentVerificationEvent" ADD CONSTRAINT "ParentVerificationEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityViolation" ADD CONSTRAINT "SecurityViolation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesterActivityLog" ADD CONSTRAINT "TesterActivityLog_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

