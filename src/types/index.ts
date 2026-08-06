export type Role = "student" | "teacher" | "superadmin";
export type EducationalStage = "sec_1" | "sec_2";

export const EDUCATIONAL_STAGES = [
  { value: "sec_1", label: "أولى بكالوريا" },
  { value: "sec_2", label: "ثانية بكالوريا" },
];

export const SUBJECTS = [
  "برمجه عملي",
  "نظري",
  "مشاريع",
];

// ========= AI STUDY ASSISTANT TYPES =========
export interface StudyPlanItem {
  topic: string;
  duration: number; // minutes
  type: "video" | "quiz" | "reading";
  courseId?: string;
  priority: "high" | "medium" | "low";
}

export interface DailyStudyPlan {
  id: string;
  studentId: string;
  planDate: Date;
  content: StudyPlanItem[];
  status: "pending" | "in_progress" | "completed";
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ========= ADMIN DASHBOARD TYPES =========
export interface TeacherStats {
  totalStudents: number;
  totalEnrollments: number;
  totalVideosViewed: number;
  averageQuizScore: number;
  courseStats: CourseStatItem[];
}

export interface CourseStatItem {
  courseId: string;
  courseName: string;
  enrollments: number;
  videosViewed: number;
  averageScore: number;
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  videosWatched: number;
  totalVideos: number;
  averageQuizScore: number;
  lastActivityAt: Date;
}

export interface AccessCodeData {
  id: string;
  code: string;
  courseId: string;
  courseName: string;
  studentId?: string;
  studentName?: string;
  isActive: boolean;
  usedAt?: Date;
  createdAt: Date;
}

// ========= AI API TYPES =========
export interface AIApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AIFallbackConfig {
  primary: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
  };
  backup: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
  };
}

// ========= ANIMATION TYPES =========
export interface AnimationVariants {
  hidden: Record<string, unknown>;
  visible: Record<string, unknown>;
  exit?: Record<string, unknown>;
}

// ========= PLANS (الخطط الدراسية) TYPES =========
export type PlanStatus = "draft" | "published" | "archived";

export interface PlanCard {
  id: string;
  title: string;
  educationalStage: string;
  monthIndex: number;
  description: string | null;
  price: number;
  discountPrice: number | null;
  discountExpiresAt: Date | null;
  durationDays: number;
  status: PlanStatus;
  _count?: {
    lessons: number;
    enrollments: number;
  };
}

export interface PlanWithLessons extends PlanCard {
  lessons: PlanLessonWithSources[];
}

export interface PlanLessonWithSources {
  id: string;
  title: string;
  order: number;
  gatesNextLesson: boolean;
  requiresQuiz: boolean;
  requiresHomework: boolean;
  hasProject: boolean;
  sources: PlanLessonSourceData[];
  quizzes?: { id: string; title: string }[];
}

export interface PlanLessonSourceData {
  id: string;
  videoId: string | null;
  teacherId: string;
  isDefault: boolean;
  isManual: boolean;
  video?: {
    title: string;
    vdoCipherId: string;
    videoProvider: string;
    providerVideoId: string;
  } | null;
}

export interface PlanEnrollmentData {
  id: string;
  planId: string;
  studentId: string;
  pricePaid: number;
  unlockedAt: Date;
  expiresAt: Date;
}

export interface PlanProgressData {
  id: string;
  planLessonId: string;
  chosenSourceId: string | null;
  watched: boolean;
  quizPassed: boolean;
  quizScore: number | null;
  homeworkPassed: boolean;
  projectPassed: boolean | null;
  projectGrade: number | null;
}
