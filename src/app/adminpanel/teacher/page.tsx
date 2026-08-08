"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { useToast } from "@/components/ui/Toast";
import { TeacherRequests } from "@/components/admin/TeacherRequests";
import { TeacherFeedback } from "@/components/admin/TeacherFeedback";
import { TeacherQuizResults } from "@/components/admin/TeacherQuizResults";
import { TeacherOverview } from "@/components/admin/TeacherOverview";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TeacherPublicProfile } from "@/components/admin/TeacherPublicProfile";
import { TeacherExamDashboard } from "@/components/admin/TeacherExamDashboard";
import { EDUCATIONAL_STAGES, SUBJECTS } from "@/types";
import {
  IconMenu, IconPlus, IconTrash, IconFolder, IconVideo, IconFile, IconLink,
  IconClipboard, IconChevronLeft, IconSettings, IconTag, IconBook, IconUsers,
  IconKey, IconShield, IconClock, IconEye,
} from "@/components/admin/AdminIcons";
import { HomeworkManagerSection, LiveReviewPanel } from "@/components/admin/TeacherHomeworkComponents";

function fileToResizedDataUrl(file: File, max = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img") as HTMLImageElement;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface Course {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  thumbnailUrl?: string;
  educationalStage?: string;
  maxWatchCount?: number | null;
  sequentialAccess?: boolean;
  homeworkUrl?: string | null;
  folders?: Folder[];
  _count?: { accessCodes?: number };
  isPaid?: boolean;
  price?: number | null;
  discountPercent?: number | null;
  discountExpiresAt?: string | null;
}

interface Folder {
  id: string;
  name: string;
  videos?: Array<{ id: string; title: string; vdoCipherId?: string; videoProvider?: string; providerVideoId?: string; maxWatchesPerUser?: number; durationMinutes?: number; isFree?: boolean }>;
  quizzes?: Array<{ id: string; title?: string }>;
  materials?: Array<{ id: string; title: string; type: string; url: string }>;
  homeworks?: Array<{ id: string; title: string; type: string; _count?: { questions?: number; submissions?: number } }>;
  _count?: { videos?: number; quizzes?: number; materials?: number; homeworks?: number };
}

interface AccessCode {
  id: string;
  code: string;
  courseId: string;
  isActive?: boolean;
  student?: { id: string; name: string; email?: string } | null;
}

// ─── Shared style vocabulary ──────────────────────────────────────────────────
const input =
  "w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm placeholder:text-[var(--ink-muted)] focus:outline-none focus:border-sky-400/60 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all";
const label = "block text-xs font-semibold text-[var(--ink-muted)] mb-1.5";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_-6px_rgba(37,99,235,0.7)]";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink-muted)]/40 text-sm font-semibold transition-colors";
const card = "bg-[var(--surface)] rounded-2xl border border-[var(--border)]";
const cardPad = `${card} p-5 sm:p-6`;

import { ReferredStudentsSection } from "@/components/admin/teacher/ReferredStudentsSection";
import { TeacherSubscriptionsSection } from "@/components/admin/teacher/TeacherSubscriptionsSection";
import { InVideoResponsesSection } from "@/components/admin/InVideoResponsesSection";

const SECTION_TITLES: Record<string, string> = {
  dashboard: "لوحة التحكم",
  "my-page": "صفحتي",
  "teacher-subscriptions": "حجوزات واشتراكات الطلاب",
  "in-video-responses": "إجابات أسئلة الفيديو",
  "quiz-results": "نتائج الاختبارات",
  "create-course": "كورس جديد",
  codes: "أكواد الوصول",
  students: "المتعلمين",
  "referred-students": "متابعة الطلاب المُحالين",
  requests: "طلبات المتعلمين",
  feedback: "ملاحظات المتعلمين",
  homework: "إدارة الواجبات",
  review: "مراجعة الإجابات",
};

interface QuizQuestionInput {
  question: string;
  questionType?: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
}

interface NewQuizState {
  title: string;
  folderId: string;
  timeLimitMinutes: number;
  questions: QuizQuestionInput[];
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [courseTab, setCourseTab] = useState<"content" | "settings" | "pricing">("content");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [plans, setPlans] = useState<Array<{ id: string; title: string; price: number; educationalStage: string; _count?: { accessCodes?: number } }>>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [codeCategory, setCodeCategory] = useState<"courses" | "plans">("courses");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  // Forms
  const [newCourse, setNewCourse] = useState({
    title: "", subject: "", description: "", thumbnailUrl: "", educationalStage: "",
  });
  const [newFolder, setNewFolder] = useState("");
  const [newFolderPublishAt, setNewFolderPublishAt] = useState("");
  const [newVideo, setNewVideo] = useState({ title: "", videoProvider: "vdocipher", providerVideoId: "", durationMinutes: 0, maxWatchesPerUser: 3, publishAt: "", folderId: "" });
  const [nativeUploading, setNativeUploading] = useState(false);
  const [nativeProgress, setNativeProgress] = useState(0);
  const [nativeStatus, setNativeStatus] = useState("");

  const handleNativeFileUpload = async (file: File) => {
    if (!file) return;
    setNativeUploading(true);
    setNativeProgress(0);
    setNativeStatus("جاري تحضير رابط الرفع الموقّع...");

    try {
      // 1. Init upload via server route
      const initRes = await fetch("/api/teacher/native-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          filename: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error || "تعذر بدء عملية الرفع");
      }

      const { uploadUrl, assetId, isLocal } = initData;

      // 2. Upload directly to signed URL or local server endpoint with XHR progress
      setNativeStatus("جاري رفع الملف للسيرفر...");

      if (isLocal || uploadUrl === "/api/teacher/native-upload") {
        const uploadedVideoId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/teacher/native-upload", true);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setNativeProgress(percent);
            }
          };

          xhr.onload = () => {
            try {
              const resJson = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && resJson.success) {
                resolve(resJson.videoId || resJson.assetId);
              } else {
                reject(new Error(resJson.error || `فشل رفع الملف (رمز الاستجابة: ${xhr.status})`));
              }
            } catch {
              reject(new Error("حدث خطأ في معالجة استجابة السيرفر"));
            }
          };

          xhr.onerror = () => reject(new Error("حدث خطأ في شبكة الاتصال أثناء الرفع"));
          xhr.send(file);
        });

        setNewVideo((prev) => ({
          ...prev,
          providerVideoId: uploadedVideoId,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
        }));

        notify("success", "تم رفع الفيديو بنجاح على السيرفر مباشرة!");
        return;
      }

      if (uploadUrl) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          if (file.type) xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setNativeProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`فشل رفع الملف (رمز الاستجابة: ${xhr.status})`));
            }
          };

          xhr.onerror = () => reject(new Error("حدث خطأ في شبكة الاتصال أثناء الرفع"));
          xhr.send(file);
        });
      }

      // 3. Complete upload
      setNativeStatus("جاري تأكيد ومعالجة الفيديو...");
      const completeRes = await fetch("/api/teacher/native-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", assetId }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.success) {
        throw new Error(completeData.error || "فشل تأكيد الرفع");
      }

      const finalVideoId = completeData.videoId || assetId;
      setNewVideo((prev) => ({
        ...prev,
        providerVideoId: finalVideoId,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));

      notify("success", "تم رفع وتأكيد الفيديو بنجاح على سيرفر Native!");
    } catch (err: any) {
      notify("error", err.message || "حدث خطأ أثناء رفع الفيديو");
    } finally {
      setNativeUploading(false);
      setNativeProgress(0);
      setNativeStatus("");
    }
  };
  const [showJsonGuide, setShowJsonGuide] = useState(false);
  const [newFolderHomework, setNewFolderHomework] = useState({
    folderId: "",
    title: "",
    description: "",
    type: "exam" as "link" | "exam" | "terminal" | "upload",
    linkUrl: "",
    videoId: "",
    timeLimitMinutes: 30,
    dueAt: "",
    isPublished: true,
    expectedOutput: "",
    codeTemplate: "",
    codeLanguage: "python",
    allowedFileTypes: "pdf,py,js,zip",
    questions: [{ question: "", imageUrl: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }],
  });
  const [newQuiz, setNewQuiz] = useState<NewQuizState>({
    title: "", folderId: "",
    timeLimitMinutes: 30,
    questions: [{ question: "", questionType: "mcq", imageUrl: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }],
  });
  const [newMaterial, setNewMaterial] = useState({ title: "", url: "", type: "pdf", folderId: "" });
  const [courseSettings, setCourseSettings] = useState({
    title: "", subject: "", description: "", thumbnailUrl: "", educationalStage: "", maxWatchCount: 3, sequentialAccess: true, homeworkUrl: "",
  });
  const [pricingSettings, setPricingSettings] = useState({
    isPaid: false, price: "", discountPercent: "", discountExpiresAt: "", allowDirectInstall: false,
  });
  const [savingPricing, setSavingPricing] = useState(false);

  // Bulk codes generation state
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Video timed questions state
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const [videoQuestions, setVideoQuestions] = useState<Record<string, any[]>>({});
  const [loadingQuestions, setLoadingQuestions] = useState<Record<string, boolean>>({});
  const [addQuestionStates, setAddQuestionStates] = useState<Record<string, any>>({});
  const [reviewPanelState, setReviewPanelState] = useState<any>(null);
  const [homeworkManagement, setHomeworkManagement] = useState<any>(null);

  // In-app confirm dialog (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<
    { title: string; message?: string; confirmLabel?: string; resolve: (v: boolean) => void } | null
  >(null);
  const askConfirm = (opts: { title: string; message?: string; confirmLabel?: string }) =>
    new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve }));

  const notify = (type: "success" | "error", text: string) => {
    if (type === "success") toastSuccess(text);
    else toastError(text);
  };

  const updateStudentAccess = async (studentId: string, action: "ban" | "unban") => {
    if (!selectedCourse) return;
    const res = await fetch("/api/admin/students", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, courseId: selectedCourse.id, action }),
    });
    const data = await readJson<{ error?: string; message?: string }>(res);
    if (res.ok) {
      fetchCodes(selectedCourse.id);
      notify("success", data?.message || (action === "ban" ? "تم حظر المتعلم بنجاح" : "تم إلغاء حظر المتعلم"));
    } else {
      notify("error", data?.error || "تعذر تحديث حالة المتعلم");
    }
  };

  const resetDevices = async (studentId: string, studentName: string) => {
    if (!confirm(`سيُسمح للطالب «${studentName}» بتسجيل الدخول من جهاز جديد (سيُطلب من الأجهزة الحالية تسجيل الدخول مجدداً). متابعة؟`)) return;
    const res = await fetch(`/api/admin/students/${studentId}/reset-devices`, { method: "POST", credentials: "include" });
    const data = await readJson<{ error?: string; cleared?: number }>(res);
    if (res.ok) notify("success", `تم تصفير أجهزة الطالب (${data?.cleared ?? 0})`);
    else notify("error", data?.error || "تعذر تصفير الأجهزة");
  };

  const fetchCourses = useCallback(async () => {
    const res = await fetch("/api/admin/courses", { credentials: "include" });
    if (res.status === 403) { router.push("/adminpanel"); return; }
    const data = await readJson<{ courses?: Course[] }>(res);
    setCourses(data?.courses || []);
    setLoading(false);
  }, [router]);

  const fetchFolders = async (courseId: string) => {
    const res = await fetch(`/api/admin/courses/${courseId}/folders`, { credentials: "include" });
    const data = await readJson<{ folders?: Folder[] }>(res);
    setFolders(data?.folders || []);
  };

  const fetchCodes = async (targetId: string, isPlan = false) => {
    const param = isPlan ? `planId=${targetId}` : `courseId=${targetId}`;
    const res = await fetch(`/api/admin/codes?${param}`, { credentials: "include" });
    const data = await readJson<{ codes?: AccessCode[] }>(res);
    setCodes(data?.codes || []);
  };

  useEffect(() => {
    const loadCoursesAndPlans = async () => {
      try {
        const [resCourses, resPlans] = await Promise.all([
          fetch("/api/admin/courses", { credentials: "include" }),
          fetch("/api/plans"),
        ]);
        if (resCourses.status === 403) { router.push("/adminpanel"); return; }
        const dataCourses = await readJson<{ courses?: Course[] }>(resCourses);
        const dataPlans = await readJson<{ plans?: any[] }>(resPlans);
        setCourses(dataCourses?.courses || []);
        setPlans(dataPlans?.plans || []);
      } catch {
        setCourses([]);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    void loadCoursesAndPlans();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/adminpanel");
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: newCourse.title.trim(),
      subject: newCourse.subject.trim(),
      description: newCourse.description.trim(),
      thumbnailUrl: newCourse.thumbnailUrl.trim(),
      educationalStage: newCourse.educationalStage.trim(),
    };
    if (!payload.title || !payload.subject || !payload.educationalStage) {
      notify("error", "العنوان والمادة والمرحلة مطلوبة");
      return;
    }
    setCreatingCourse(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ error?: string }>(res);
      if (res.ok) {
        notify("success", "تم إنشاء الكورس بنجاح");
        setNewCourse({ title: "", subject: "", description: "", thumbnailUrl: "", educationalStage: "" });
        await fetchCourses();
        setActiveSection("courses");
      } else {
        notify("error", data?.error || "تعذر إنشاء الكورس");
      }
    } catch {
      notify("error", "تعذر إنشاء الكورس الآن");
    } finally {
      setCreatingCourse(false);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!(await askConfirm({ title: "حذف الكورس", message: "سيتم حذف الكورس وكل محتواه نهائياً. لا يمكن التراجع.", confirmLabel: "حذف الكورس" }))) return;
    const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE", credentials: "include" });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      notify("success", "تم حذف الكورس بنجاح");
      fetchCourses();
    } else {
      notify("error", data?.error || "تعذر حذف الكورس");
    }
    if (selectedCourse?.id === courseId) setSelectedCourse(null);
  };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newFolder.trim()) return;
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}/folders`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolder, publishAt: newFolderPublishAt || null }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      setNewFolder("");
      setNewFolderPublishAt("");
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم إضافة المحاضرة بنجاح");
    } else {
      notify("error", data?.error || "تعذر إضافة المحاضرة");
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!selectedCourse) return;
    if (!(await askConfirm({ title: "حذف المحاضرة", message: "سيتم حذف المحاضرة وكل محتواها (فيديوهات، اختبارات، ملحقات). لا يمكن التراجع.", confirmLabel: "حذف المحاضرة" }))) return;
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}/folders`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      fetchFolders(selectedCourse.id);
      notify("success", "تم حذف المحاضرة بنجاح");
    } else {
      notify("error", data?.error || "تعذر حذف المحاضرة");
    }
  };

  const addVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideo.folderId) return;
    const res = await fetch(`/api/admin/folders/${newVideo.folderId}/videos`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newVideo.title,
        videoProvider: newVideo.videoProvider,
        providerVideoId: newVideo.providerVideoId,
        durationMinutes: newVideo.durationMinutes,
        maxWatchesPerUser: newVideo.maxWatchesPerUser,
        publishAt: newVideo.publishAt || null,
      }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      setNewVideo({ title: "", videoProvider: "vdocipher", providerVideoId: "", durationMinutes: 0, maxWatchesPerUser: 3, publishAt: "", folderId: "" });
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم إضافة الفيديو بنجاح");
    } else {
      notify("error", data?.error || "تعذر إضافة الفيديو");
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!(await askConfirm({ title: "حذف الفيديو", message: "سيتم حذف هذا الفيديو نهائياً.", confirmLabel: "حذف الفيديو" }))) return;
    if (!selectedCourse) return;
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}/videos`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم حذف الفيديو بنجاح");
    } else {
      notify("error", data?.error || "تعذر حذف الفيديو");
    }
  };

  const patchVideo = async (videoId: string, body: { maxWatchesPerUser?: number; durationMinutes?: number; isFree?: boolean }) => {
    await fetch(`/api/admin/videos/${videoId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (selectedCourse) fetchFolders(selectedCourse.id);
  };
  const updateVideoWatches = (videoId: string, val: number) => patchVideo(videoId, { maxWatchesPerUser: val });

  const downloadSampleQuizJson = () => {
    const sample = {
      title: "اختبار مراجعة شاملة (نموذج)",
      timeLimitMinutes: 30,
      questions: [
        {
          question: "ما هي وحدة قياس القوة في النظام الدولي؟",
          questionType: "mcq",
          imageUrl: "",
          optionA: "النيوتن",
          optionB: "الجول",
          optionC: "الفولت",
          optionD: "الواط",
          correctAnswer: "A"
        },
        {
          question: "اشرح قانون نيوتن الأول وتطبيقاته باختصار",
          "questionType": "essay"
        }
      ]
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quiz_sample.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuizJsonImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let importedTitle = "";
        let importedTime = 30;
        let rawQuestions: any[] = [];

        if (Array.isArray(parsed)) {
          rawQuestions = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (typeof parsed.title === "string") importedTitle = parsed.title;
          if (typeof parsed.timeLimitMinutes === "number") importedTime = parsed.timeLimitMinutes;
          if (Array.isArray(parsed.questions)) rawQuestions = parsed.questions;
        }

        if (!rawQuestions || rawQuestions.length === 0) {
          notify("error", "ملف الـ JSON لا يحتوي على أي أسئلة صحيحة");
          return;
        }

        const validQuestions = rawQuestions.map((q, idx) => {
          if (!q || typeof q !== "object") throw new Error(`السؤال ${idx + 1} بتنسيق غير صحيح`);
          const isEssay = q.questionType === "essay";
          return {
            question: String(q.question || q.title || "").trim(),
            questionType: isEssay ? "essay" : "mcq",
            imageUrl: typeof q.imageUrl === "string" ? q.imageUrl.trim() : "",
            optionA: isEssay ? "" : String(q.optionA || q.a || "").trim(),
            optionB: isEssay ? "" : String(q.optionB || q.b || "").trim(),
            optionC: isEssay ? "" : String(q.optionC || q.c || "").trim(),
            optionD: isEssay ? "" : String(q.optionD || q.d || "").trim(),
            correctAnswer: isEssay ? "A" : (["A", "B", "C", "D"].includes(String(q.correctAnswer).toUpperCase()) ? String(q.correctAnswer).toUpperCase() : "A"),
          };
        });

        setNewQuiz((prev) => ({
          ...prev,
          title: importedTitle || prev.title,
          timeLimitMinutes: importedTime || prev.timeLimitMinutes,
          questions: validQuestions,
        }));
        notify("success", `تم استيراد ${validQuestions.length} سؤال من ملف الـ JSON بنجاح ✅`);
      } catch (err: any) {
        notify("error", err?.message || "فشل قراءة ملف الـ JSON، تأكد من صحة التنسيق");
      }
    };
    reader.readAsText(file);
  };

  const addQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuiz.folderId) return;
    const res = await fetch(`/api/admin/folders/${newQuiz.folderId}/quizzes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newQuiz.title, questions: newQuiz.questions, timeLimitMinutes: newQuiz.timeLimitMinutes }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      setNewQuiz({ title: "", folderId: "", timeLimitMinutes: 30, questions: [{ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }] });
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم إضافة الاختبار بنجاح");
    } else {
      notify("error", data?.error || "تعذر إضافة الاختبار");
    }
  };

  const handleFolderHwJsonImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let importedTitle = "";
        let importedTime = 30;
        let rawQuestions: any[] = [];

        if (Array.isArray(parsed)) {
          rawQuestions = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (typeof parsed.title === "string") importedTitle = parsed.title;
          if (typeof parsed.timeLimitMinutes === "number") importedTime = parsed.timeLimitMinutes;
          if (Array.isArray(parsed.questions)) rawQuestions = parsed.questions;
        }

        if (!rawQuestions || rawQuestions.length === 0) {
          notify("error", "ملف الـ JSON لا يحتوي على أي أسئلة صحيحة");
          return;
        }

        const validQuestions = rawQuestions.map((q, idx) => {
          if (!q || typeof q !== "object") throw new Error(`السؤال ${idx + 1} بتنسيق غير صحيح`);
          return {
            question: String(q.question || q.title || "").trim(),
            imageUrl: typeof q.imageUrl === "string" ? q.imageUrl.trim() : "",
            optionA: String(q.optionA || q.a || "").trim(),
            optionB: String(q.optionB || q.b || "").trim(),
            optionC: String(q.optionC || q.c || "").trim(),
            optionD: String(q.optionD || q.d || "").trim(),
            correctAnswer: (["A", "B", "C", "D"].includes(String(q.correctAnswer).toUpperCase()) ? String(q.correctAnswer).toUpperCase() : "A"),
          };
        });

        setNewFolderHomework((prev) => ({
          ...prev,
          title: importedTitle || prev.title,
          timeLimitMinutes: importedTime || prev.timeLimitMinutes,
          questions: validQuestions,
        }));
        notify("success", `تم استيراد ${validQuestions.length} سؤال من ملف الـ JSON بنجاح ✅`);
      } catch (err: any) {
        notify("error", err?.message || "فشل قراءة ملف الـ JSON، تأكد من صحة التنسيق");
      }
    };
    reader.readAsText(file);
  };

  const addHomeworkToFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderHomework.folderId) return;
    const payload: Record<string, unknown> = {
      title: newFolderHomework.title,
      description: newFolderHomework.description || undefined,
      type: newFolderHomework.type,
      courseId: selectedCourse?.id || undefined,
      folderId: newFolderHomework.folderId,
      videoId: newFolderHomework.videoId || undefined,
      dueAt: newFolderHomework.dueAt || undefined,
      timeLimitMinutes: newFolderHomework.timeLimitMinutes,
      isPublished: newFolderHomework.isPublished,
    };
    if (newFolderHomework.type === "link") payload.linkUrl = newFolderHomework.linkUrl;
    if (newFolderHomework.type === "terminal") {
      payload.expectedOutput = newFolderHomework.expectedOutput;
      payload.codeTemplate = newFolderHomework.codeTemplate || undefined;
      payload.codeLanguage = newFolderHomework.codeLanguage;
    }
    if (newFolderHomework.type === "upload") payload.allowedFileTypes = newFolderHomework.allowedFileTypes || undefined;
    if (newFolderHomework.type === "exam") payload.questions = newFolderHomework.questions;

    const res = await fetch("/api/admin/homework", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      setNewFolderHomework({
        folderId: "",
        title: "",
        description: "",
        type: "exam",
        linkUrl: "",
        videoId: "",
        timeLimitMinutes: 30,
        dueAt: "",
        isPublished: true,
        expectedOutput: "",
        codeTemplate: "",
        codeLanguage: "python",
        allowedFileTypes: "pdf,py,js,zip",
        questions: [{ question: "", imageUrl: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }],
      });
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم إضافة الواجب للمحاضرة بنجاح ✅");
    } else {
      notify("error", data?.error || "تعذر إضافة الواجب");
    }
  };

  const deleteHomeworkFromFolder = async (homeworkId: string) => {
    if (!(await askConfirm({ title: "حذف الواجب", message: "سيتم حذف هذا الواجب وجميع إجابات الطلاب المرتبطة به نهائياً.", confirmLabel: "حذف الواجب" }))) return;
    const res = await fetch("/api/admin/homework", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeworkId }),
    });
    if (res.ok) {
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم حذف الواجب بنجاح");
    } else {
      notify("error", "تعذر حذف الواجب");
    }
  };

  const addMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.folderId) return;
    const res = await fetch(`/api/admin/folders/${newMaterial.folderId}/materials`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newMaterial.title, url: newMaterial.url, type: newMaterial.type }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      setNewMaterial({ title: "", url: "", type: "pdf", folderId: "" });
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم إضافة الملحق بنجاح");
    } else {
      notify("error", data?.error || "تعذر إضافة الملحق");
    }
  };

  const deleteMaterial = async (materialId: string) => {
    if (!(await askConfirm({ title: "حذف الملحق", message: "سيتم حذف هذا الملحق نهائياً.", confirmLabel: "حذف الملحق" }))) return;
    if (!selectedCourse) return;
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}/materials`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialId }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      if (selectedCourse) fetchFolders(selectedCourse.id);
      notify("success", "تم حذف الملحق بنجاح");
    } else {
      notify("error", data?.error || "تعذر حذف الملحق");
    }
  };

  const generateCodes = async (targetId: string, count: number, isPlan = false) => {
    const body = isPlan ? { planId: targetId, count } : { courseId: targetId, count };
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      fetchCodes(targetId, isPlan);
      notify("success", `تم إنشاء ${count} كود بنجاح`);
    } else {
      notify("error", data?.error || "تعذر إنشاء الأكواد");
    }
  };

  const toggleCode = async (codeId: string, isActive: boolean, isPlan = false) => {
    const res = await fetch("/api/admin/codes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeId, isActive, isPlanCode: isPlan }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      const targetId = isPlan ? selectedPlan?.id : selectedCourse?.id;
      if (targetId) fetchCodes(targetId, isPlan);
      notify("success", isActive ? "تم تفعيل الكود" : "تم تعطيل الكود");
    } else {
      notify("error", data?.error || "تعذر تحديث الكود");
    }
  };

  const handleBulkGenerate = async () => {
    if (!selectedCourse && !selectedPlan) return;
    const targetId = selectedPlan ? selectedPlan.id : selectedCourse!.id;
    const isPlan = !!selectedPlan;
    setBulkGenerating(true);
    try {
      const body = isPlan
        ? { planId: targetId, count: bulkCount, prefix: bulkPrefix, format: "csv" }
        : { courseId: targetId, count: bulkCount, prefix: bulkPrefix, format: "csv" };
      const response = await fetch("/api/admin/codes/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        notify("error", errData.error || "فشل توليد الأكواد");
        setBulkGenerating(false);
        return;
      }

      // Download CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch?.[1] || `codes-${targetId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      notify("success", `تم توليد ${bulkCount} كود وتحميل الملف بنجاح`);
      fetchCodes(targetId, isPlan);
    } catch (err) {
      notify("error", "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setBulkGenerating(false);
    }
  };

  const loadVideoQuestions = async (videoId: string) => {
    setLoadingQuestions((prev) => ({ ...prev, [videoId]: true }));
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/questions`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.questions) {
        setVideoQuestions((prev) => ({ ...prev, [videoId]: data.questions }));
      }
    } catch {
      notify("error", "تعذر تحميل أسئلة الفيديو");
    } finally {
      setLoadingQuestions((prev) => ({ ...prev, [videoId]: false }));
    }
  };

  const toggleVideoQuestions = (videoId: string) => {
    const isNowOpen = !expandedQuestions[videoId];
    setExpandedQuestions((prev) => ({ ...prev, [videoId]: isNowOpen }));
    if (isNowOpen) {
      void loadVideoQuestions(videoId);
    }
  };

  const handleDeleteQuestion = async (videoId: string, questionId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا السؤال نهائياً؟")) return;
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/questions`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        notify("success", "تم حذف السؤال بنجاح");
        void loadVideoQuestions(videoId);
      } else {
        const d = await res.json();
        notify("error", d.error || "تعذر حذف السؤال");
      }
    } catch {
      notify("error", "حدث خطأ أثناء حذف السؤال");
    }
  };

  const getAddQuestionState = (videoId: string) => {
    return addQuestionStates[videoId] || {
      triggerTimestamp: "",
      mode: "pause",
      questionType: "mcq",
      questionText: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctOption: "A",
      explanation: "",
      refireOnRewatch: false,
    };
  };

  const updateAddQuestionState = (videoId: string, fields: Partial<any>) => {
    setAddQuestionStates((prev) => ({
      ...prev,
      [videoId]: { ...getAddQuestionState(videoId), ...fields },
    }));
  };

  const handleAddQuestion = async (e: React.FormEvent, videoId: string) => {
    e.preventDefault();
    const state = getAddQuestionState(videoId);

    // Parse MM:SS to seconds
    let seconds = 0;
    if (state.triggerTimestamp.includes(":")) {
      const [m, s] = state.triggerTimestamp.split(":").map(Number);
      if (isNaN(m) || isNaN(s)) {
        notify("error", "توقيت غير صالح. استخدم تنسيق MM:SS");
        return;
      }
      seconds = m * 60 + s;
    } else {
      seconds = Number(state.triggerTimestamp);
      if (isNaN(seconds) || seconds < 0) {
        notify("error", "توقيت غير صالح. أدخل الثواني الإجمالية أو تنسيق MM:SS");
        return;
      }
    }

    try {
      const res = await fetch(`/api/admin/videos/${videoId}/questions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerSecond: seconds,
          mode: state.mode,
          questionType: state.questionType || "mcq",
          questionText: state.questionText,
          optionA: state.optionA,
          optionB: state.optionB,
          optionC: state.optionC,
          optionD: state.optionD,
          correctOption: state.correctOption,
          explanation: state.explanation,
          refireOnRewatch: state.refireOnRewatch,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        notify("success", "تم إضافة السؤال بنجاح");
        // Reset form
        setAddQuestionStates((prev) => {
          const next = { ...prev };
          delete next[videoId];
          return next;
        });
        void loadVideoQuestions(videoId);
      } else {
        notify("error", data.error || "تعذر إضافة السؤال");
      }
    } catch {
      notify("error", "حدث خطأ أثناء إضافة السؤال");
    }
  };

  // `section` lets each caller stay in its own tab (codes/students) instead of
  // always jumping to the course editor.
  const selectCourse = (course: Course, section: "courses" | "codes" | "students" = "courses") => {
    setSelectedCourse(course);
    setCourseTab("content");
    setCourseSettings({
      title: course.title,
      subject: course.subject || "",
      description: course.description || "",
      thumbnailUrl: course.thumbnailUrl || "",
      educationalStage: course.educationalStage || "",
      maxWatchCount: course.maxWatchCount ?? 3,
      sequentialAccess: course.sequentialAccess ?? true,
      homeworkUrl: course.homeworkUrl || "",
    });
    setPricingSettings({
      isPaid: course.isPaid ?? false,
      price: course.price != null ? String(course.price) : "",
      discountPercent: course.discountPercent != null ? String(course.discountPercent) : "",
      discountExpiresAt: course.discountExpiresAt
        ? new Date(course.discountExpiresAt).toISOString().slice(0, 16)
        : "",
      allowDirectInstall: (course as any).allowDirectInstall ?? false,
    });
    fetchFolders(course.id);
    fetchCodes(course.id);
    setActiveSection(section);
  };

  const savePricingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setSavingPricing(true);
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}/pricing`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPaid: pricingSettings.isPaid,
        price: pricingSettings.price ? parseFloat(pricingSettings.price) : null,
        discountPercent: pricingSettings.discountPercent ? parseFloat(pricingSettings.discountPercent) : null,
        discountExpiresAt: pricingSettings.discountExpiresAt || null,
        allowDirectInstall: pricingSettings.allowDirectInstall,
      }),
    });
    const data = await readJson<{ error?: string }>(res);
    setSavingPricing(false);
    if (res.ok) {
      notify("success", "تم حفظ إعدادات التسعير");
      fetchCourses();
    } else {
      notify("error", data?.error || "تعذر حفظ إعدادات التسعير");
    }
  };

  const saveCourseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const res = await fetch(`/api/admin/courses/${selectedCourse.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...courseSettings,
        homeworkUrl: courseSettings.homeworkUrl || null,
        maxWatchCount: courseSettings.maxWatchCount,
        sequentialAccess: courseSettings.sequentialAccess,
      }),
    });
    const data = await readJson<{ course?: Course; error?: string }>(res);
    if (res.ok) {
      notify("success", "تم حفظ إعدادات الكورس");
      setSelectedCourse((current) => (current && data?.course ? { ...current, ...data.course } : current));
      fetchCourses();
    } else {
      notify("error", data?.error || "تعذر حفظ إعدادات الكورس");
    }
  };

  const headerTitle =
    activeSection === "courses"
      ? (selectedCourse ? selectedCourse.title : "الكورسات")
      : SECTION_TITLES[activeSection] ?? "لوحة التحكم";

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <AdminSidebar
        role="teacher"
        activeSection={activeSection}
        setActiveSection={(s) => { setActiveSection(s); if (s !== "courses") setSelectedCourse(null); }}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--surface)] lg:bg-[var(--surface)]/85 lg:backdrop-blur-xl border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ink)] hover:bg-[var(--border)] transition-colors shrink-0"
          >
            <IconMenu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1 flex items-center gap-2">
            {activeSection === "courses" && selectedCourse && (
              <button
                onClick={() => setSelectedCourse(null)}
                aria-label="رجوع للكورسات"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--border)] transition-colors"
              >
                <IconChevronLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
            )}
            <h1 className="text-base sm:text-lg font-black text-[var(--ink)] truncate">{headerTitle}</h1>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-sky-500/12 text-sky-500 dark:text-sky-300 px-3 py-1.5 rounded-full">
            <IconShield className="w-3.5 h-3.5" /> مدرس
          </span>
          <DarkModeToggle />
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {/* ════════ DASHBOARD (analytics overview) ════════ */}
          {activeSection === "dashboard" && (
            <TeacherOverview
              courses={courses.map((c) => ({ id: c.id, title: c.title }))}
              onCreateCourse={() => setActiveSection("create-course")}
              onGoToMyPage={() => setActiveSection("my-page")}
              loadingCourses={loading}
            />
          )}

          {/* ════════ MY PAGE (public teacher profile) ════════ */}
          {activeSection === "my-page" && <TeacherPublicProfile />}

          {/* ════════ TEACHER SUBSCRIPTIONS ════════ */}
          {activeSection === "teacher-subscriptions" && <TeacherSubscriptionsSection />}

          {/* ════════ EXAM DASHBOARD ════════ */}
          {activeSection === "exam-dashboard" && (
            <TeacherExamDashboard
              onNavigateToEssayGrading={() => setActiveSection("in-video-responses")}
              onNavigateToResults={() => setActiveSection("quiz-results")}
              onNavigateToCreateQuiz={() => setActiveSection("courses")}
            />
          )}

          {/* ════════ IN-VIDEO RESPONSES ════════ */}
          {activeSection === "in-video-responses" && <InVideoResponsesSection />}

          {/* ════════ REFERRED STUDENTS ════════ */}
          {activeSection === "referred-students" && <ReferredStudentsSection />}

          {/* ════════ COURSES ════════ */}
          {activeSection === "courses" && (
            !selectedCourse ? (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
                  <h2 className="font-bold text-[var(--ink)]">كورساتي <span className="text-[var(--ink-muted)] font-normal">({courses.length})</span></h2>
                  <button onClick={() => setActiveSection("create-course")} className={primaryBtn}>
                    <IconPlus className="w-4 h-4" /> <span className="hidden sm:inline">كورس جديد</span>
                  </button>
                </div>
                {courses.length === 0 ? (
                  <EmptyState
                    icon={<IconBook className="w-7 h-7" />}
                    title="لا توجد كورسات"
                    hint="أنشئ كورسك الأول للبدء."
                    action={<button onClick={() => setActiveSection("create-course")} className={primaryBtn}><IconPlus className="w-4 h-4" /> إنشاء كورس</button>}
                  />
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {courses.map((c) => (
                      <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
                        <button onClick={() => selectCourse(c)} className="flex items-center gap-3 min-w-0 text-right flex-1">
                          <CourseThumb course={c} />
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--ink)] truncate">{c.title}</p>
                            <p className="text-xs text-[var(--ink-muted)] truncate">
                              {c.subject} · {c._count?.accessCodes || 0} طالب · {c.folders?.length || 0} محاضرة
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => window.open(`/courses/${c.id}/learn`, "_blank")}
                            title="معاينة الكورس كما يراه الطالب"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                          >
                            <IconEye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">معاينة كطالب</span>
                          </button>
                          <button
                            onClick={() => deleteCourse(c.id)}
                            aria-label="حذف الكورس"
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] w-full sm:w-fit">
                  {([
                    { id: "content", label: "المحتوى", Icon: IconFolder },
                    { id: "settings", label: "الإعدادات", Icon: IconSettings },
                    { id: "pricing", label: "التسعير", Icon: IconTag },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCourseTab(t.id)}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        courseTab === t.id ? "bg-sky-500 text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <t.Icon className="w-4 h-4" /> <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── CONTENT TAB ── */}
                {courseTab === "content" && (
                  <div className="space-y-5">
                    {/* Add folder */}
                    <div className={cardPad}>
                      <h3 className="font-bold text-[var(--ink)] mb-3 flex items-center gap-2"><IconFolder className="w-4 h-4 text-sky-500" /> إضافة محاضرة</h3>
                      <form onSubmit={createFolder} className="space-y-2">
                        <div className="flex gap-2">
                          <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="مثال: المحاضرة الأولى" className={input} />
                          <button type="submit" disabled={!newFolder.trim()} className={`${primaryBtn} shrink-0`}>
                            <IconPlus className="w-4 h-4" /> <span className="hidden sm:inline">إضافة</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-[var(--ink-muted)] whitespace-nowrap"><IconClock className="w-3.5 h-3.5 inline -mt-0.5 me-1" />يُفتح في (اختياري):</label>
                          <input type="datetime-local" value={newFolderPublishAt} onChange={(e) => setNewFolderPublishAt(e.target.value)} className={`${input} text-xs`} dir="ltr" />
                          {newFolderPublishAt && (
                            <button type="button" onClick={() => setNewFolderPublishAt("")} className="text-[11px] text-[var(--ink-muted)] hover:text-[var(--error)] shrink-0">مسح</button>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--ink-muted)]">عند تحديد موعد، تظل المحاضرة وكل فيديوهاتها مقفلة للطلاب حتى ذلك الوقت.</p>
                      </form>
                    </div>

                    {/* Folders list */}
                    {folders.length === 0 ? (
                      <div className={cardPad}>
                        <EmptyState icon={<IconFolder className="w-7 h-7" />} title="لا توجد محاضرات" hint="أضف أول محاضرة من الحقل بالأعلى، ثم أضف إليها الفيديوهات." />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {folders.map((f) => (
                          <div key={f.id} className={`${card} p-4 sm:p-5`}>
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-8 h-8 rounded-lg bg-sky-500/12 text-sky-500 dark:text-sky-300 flex items-center justify-center shrink-0">
                                  <IconFolder className="w-4 h-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-[var(--ink)] truncate">{f.name}</p>
                                  <p className="text-[11px] text-[var(--ink-muted)]">
                                    {f.videos?.length || 0} فيديو · {f.quizzes?.length || 0} اختبار · {f.materials?.length || 0} ملحق
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => deleteFolder(f.id)}
                                aria-label="حذف المحاضرة"
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                              >
                                <IconTrash className="w-3.5 h-3.5" /> <span className="hidden sm:inline">حذف</span>
                              </button>
                            </div>

                            {(f.videos?.length || f.materials?.length) ? (
                              <div className="space-y-2">
                                {f.videos?.map((video) => {
                                  const prov = video.videoProvider || "vdocipher";
                                  const provLabel = prov === "bunny" ? "Bunny" : prov === "youtube" ? "YouTube" : "VdoCipher";
                                  const provColor = prov === "bunny" ? "text-orange-500 bg-orange-500/12" : prov === "youtube" ? "text-red-500 bg-red-500/12" : "text-sky-500 bg-sky-500/12";
                                  return (
                                    <div key={video.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="shrink-0 text-[var(--ink-muted)]"><IconVideo className="w-4 h-4" /></span>
                                        <p className="text-sm text-[var(--ink)] font-medium truncate flex-1 min-w-0">{video.title}</p>
                                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${provColor}`}>{provLabel}</span>
                                        {video.isFree && (
                                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">مجاني</span>
                                        )}
                                        {/* Free / demo toggle */}
                                        <button
                                          type="button"
                                          onClick={() => patchVideo(video.id, { isFree: !video.isFree })}
                                          aria-pressed={video.isFree}
                                          title="جعله مجانياً / تجريبياً — يشاهده غير المشتركين بلا حدود"
                                          className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                                            video.isFree
                                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                              : "border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                                          }`}
                                        >
                                          {video.isFree ? "تجريبي ✓" : "اجعله تجريبياً"}
                                        </button>
                                        {/* Watch limit — only for paid (non-free) videos */}
                                        {!video.isFree && (
                                          <label className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                                            <IconEye className="w-3.5 h-3.5" />
                                            <select
                                              value={video.maxWatchesPerUser ?? 3}
                                              onChange={(e) => updateVideoWatches(video.id, parseInt(e.target.value))}
                                              className="bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] rounded-lg pe-1 ps-2 py-1 text-xs font-bold focus:outline-none focus:border-sky-400/60 cursor-pointer"
                                              aria-label="عدد المشاهدات"
                                            >
                                              {[1, 2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}×</option>)}
                                            </select>
                                          </label>
                                        )}
                                        {/* Timed Questions toggle */}
                                        <button
                                          type="button"
                                          onClick={() => toggleVideoQuestions(video.id)}
                                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                            expandedQuestions[video.id]
                                              ? "border-sky-500/40 bg-sky-500/10 text-sky-500"
                                              : "border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                                          }`}
                                        >
                                          <span>❓ أسئلة الفيديو</span>
                                          <span className="w-4 h-4 rounded-full bg-[var(--border)] text-[9px] flex items-center justify-center font-bold">
                                            {videoQuestions[video.id]?.length ?? "•"}
                                          </span>
                                        </button>
                                        <button onClick={() => deleteVideo(video.id)} aria-label="حذف الفيديو" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors">
                                          <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Timed Questions Expandable Panel */}
                                      {expandedQuestions[video.id] && (
                                        <div className="mt-2 border-t border-[var(--border)] pt-3 space-y-4 bg-[var(--surface)]/30 rounded-xl p-3">
                                          <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                                            <span>أسئلة هذا الفيديو</span>
                                            {loadingQuestions[video.id] && (
                                              <span className="w-3.5 h-3.5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                                            )}
                                          </h4>

                                          {/* Questions list */}
                                          {(!videoQuestions[video.id] || videoQuestions[video.id].length === 0) ? (
                                            <p className="text-xs text-[var(--ink-muted)]">لا توجد أسئلة مضافة لهذا الفيديو بعد.</p>
                                          ) : (
                                            <div className="space-y-3">
                                              {videoQuestions[video.id].map((q) => {
                                                const timeFormatted = `${Math.floor(q.triggerSecond / 60)}:${String(q.triggerSecond % 60).padStart(2, "0")}`;
                                                const isEssayQ = q.questionType === "essay";
                                                return (
                                                  <div key={q.id} className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex flex-col gap-2 relative">
                                                    <div className="flex items-center justify-between gap-3">
                                                      <div className="flex items-center gap-2">
                                                        <span className="bg-sky-500/10 text-sky-500 text-[10px] font-bold px-2 py-0.5 rounded-lg" dir="ltr">⏱ {timeFormatted}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isEssayQ ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}`}>
                                                          {isEssayQ ? "📝 سؤال مقالي" : "اختيار من متعدد"}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${q.mode === "pause" ? "bg-amber-500/10 text-amber-500" : "bg-teal-500/10 text-teal-500"}`}>
                                                          {q.mode === "pause" ? "إيقاف الفيديو" : "عرض بدون إيقاف"}
                                                        </span>
                                                        {q.refireOnRewatch && (
                                                          <span className="bg-purple-500/10 text-purple-500 text-[10px] font-bold px-2 py-0.5 rounded-lg">إعادة تكرار</span>
                                                        )}
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleDeleteQuestion(video.id, q.id)}
                                                        className="text-xs text-[var(--error)] hover:underline"
                                                      >
                                                        حذف
                                                      </button>
                                                    </div>
                                                    <p className="text-xs font-semibold text-[var(--ink)]">{q.questionText}</p>
                                                    {!isEssayQ && (
                                                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--ink-muted)] mt-1">
                                                        <div className={q.correctOption === "A" ? "text-emerald-500 font-bold" : ""}>أ) {q.optionA}</div>
                                                        <div className={q.correctOption === "B" ? "text-emerald-500 font-bold" : ""}>ب) {q.optionB}</div>
                                                        <div className={q.correctOption === "C" ? "text-emerald-500 font-bold" : ""}>ج) {q.optionC}</div>
                                                        <div className={q.correctOption === "D" ? "text-emerald-500 font-bold" : ""}>د) {q.optionD}</div>
                                                      </div>
                                                    )}
                                                    {q.explanation && (
                                                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">الشرح: {q.explanation}</p>
                                                    )}

                                                    {/* Analytics */}
                                                    {q.analytics && q.analytics.totalResponses > 0 && (
                                                      <div className="mt-2 border-t border-[var(--border)]/60 pt-2 flex items-center gap-4 text-[10px] text-[var(--ink-muted)]">
                                                        <span>إجمالي الإجابات: <strong>{q.analytics.totalResponses}</strong></span>
                                                        {!isEssayQ && (
                                                          <span>نسبة الإجابة الصحيحة: <strong className="text-emerald-500">{q.analytics.correctPercent}%</strong></span>
                                                        )}
                                                        <span>متوسط زمن الاستجابة: <strong>+{q.analytics.avgResponseDelay}ث</strong></span>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {/* Add timed question form */}
                                          <form onSubmit={(e) => handleAddQuestion(e, video.id)} className="border-t border-[var(--border)] pt-3 space-y-3">
                                            <h5 className="text-[11px] font-bold text-[var(--ink)]">إضافة سؤال جديد للفيديو</h5>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <label className={label}>نوع السؤال *</label>
                                                <select
                                                  value={getAddQuestionState(video.id).questionType || "mcq"}
                                                  onChange={(e) => updateAddQuestionState(video.id, { questionType: e.target.value })}
                                                  className={input}
                                                >
                                                  <option value="mcq">اختيار من متعدد (MCQ)</option>
                                                  <option value="essay">سؤال مقالي (تصحيح يدوي)</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className={label}>التوقيت (ثواني أو MM:SS) *</label>
                                                <input
                                                  type="text"
                                                  required
                                                  placeholder="مثال: 01:30 أو 90"
                                                  value={getAddQuestionState(video.id).triggerTimestamp}
                                                  onChange={(e) => updateAddQuestionState(video.id, { triggerTimestamp: e.target.value })}
                                                  className={input}
                                                  dir="ltr"
                                                />
                                              </div>
                                              <div>
                                                <label className={label}>طريقة العرض *</label>
                                                <select
                                                  value={getAddQuestionState(video.id).mode}
                                                  onChange={(e) => updateAddQuestionState(video.id, { mode: e.target.value })}
                                                  className={input}
                                                >
                                                  <option value="pause">إيقاف الفيديو حتى الإجابة (Pause)</option>
                                                  <option value="overlay">عرض كارت زاوية بدون إيقاف (Overlay)</option>
                                                </select>
                                              </div>
                                            </div>

                                            <div>
                                              <label className={label}>نص السؤال *</label>
                                              <input
                                                type="text"
                                                required
                                                placeholder="اكتب السؤال بوضوح للطالب..."
                                                value={getAddQuestionState(video.id).questionText}
                                                onChange={(e) => updateAddQuestionState(video.id, { questionText: e.target.value })}
                                                className={input}
                                              />
                                            </div>

                                            {getAddQuestionState(video.id).questionType !== "essay" && (
                                               <>
                                                 <div className="grid grid-cols-2 gap-2">
                                                   <div>
                                                     <label className={label}>الخيار أ *</label>
                                                     <input
                                                       type="text"
                                                       required
                                                       value={getAddQuestionState(video.id).optionA}
                                                       onChange={(e) => updateAddQuestionState(video.id, { optionA: e.target.value })}
                                                       className={input}
                                                     />
                                                   </div>
                                                   <div>
                                                     <label className={label}>الخيار ب *</label>
                                                     <input
                                                       type="text"
                                                       required
                                                       value={getAddQuestionState(video.id).optionB}
                                                       onChange={(e) => updateAddQuestionState(video.id, { optionB: e.target.value })}
                                                       className={input}
                                                     />
                                                   </div>
                                                   <div>
                                                     <label className={label}>الخيار ج *</label>
                                                     <input
                                                       type="text"
                                                       required
                                                       value={getAddQuestionState(video.id).optionC}
                                                       onChange={(e) => updateAddQuestionState(video.id, { optionC: e.target.value })}
                                                       className={input}
                                                     />
                                                   </div>
                                                   <div>
                                                     <label className={label}>الخيار د *</label>
                                                     <input
                                                       type="text"
                                                       required
                                                       value={getAddQuestionState(video.id).optionD}
                                                       onChange={(e) => updateAddQuestionState(video.id, { optionD: e.target.value })}
                                                       className={input}
                                                     />
                                                   </div>
                                                 </div>

                                                 <div className="grid grid-cols-2 gap-2">
                                                   <div>
                                                     <label className={label}>الإجابة الصحيحة *</label>
                                                     <select
                                                       value={getAddQuestionState(video.id).correctOption}
                                                       onChange={(e) => updateAddQuestionState(video.id, { correctOption: e.target.value })}
                                                       className={input}
                                                     >
                                                       <option value="A">الخيار أ</option>
                                                       <option value="B">الخيار ب</option>
                                                       <option value="C">الخيار ج</option>
                                                       <option value="D">الخيار د</option>
                                                     </select>
                                                   </div>
                                                   <div>
                                                     <label className={label}>خيار التكرار</label>
                                                     <div className="flex items-center gap-2 h-[38px]">
                                                       <input
                                                         type="checkbox"
                                                         id={`refire-${video.id}`}
                                                         checked={getAddQuestionState(video.id).refireOnRewatch}
                                                         onChange={(e) => updateAddQuestionState(video.id, { refireOnRewatch: e.target.checked })}
                                                         className="w-4 h-4 text-sky-500 rounded border-[var(--border)] focus:ring-sky-500"
                                                       />
                                                       <label htmlFor={`refire-${video.id}`} className="text-xs text-[var(--ink)] select-none">تكرار السؤال عند إعادة التشغيل</label>
                                                     </div>
                                                   </div>
                                                 </div>
                                               </>
                                             )}

                                             <div>
                                               <label className={label}>الشرح / التفسير (اختياري)</label>
                                              <input
                                                type="text"
                                                placeholder="شرح مبسط يظهر للمتعلم بعد الإجابة..."
                                                value={getAddQuestionState(video.id).explanation}
                                                onChange={(e) => updateAddQuestionState(video.id, { explanation: e.target.value })}
                                                className={input}
                                              />
                                            </div>

                                            <button
                                              type="submit"
                                              className={`${primaryBtn} w-full text-xs py-2`}
                                            >
                                              حفظ السؤال
                                            </button>
                                          </form>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                 {f.quizzes?.map((qz) => (
                                   <div key={qz.id} className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
                                     <span className="shrink-0 text-sky-500"><IconClipboard className="w-4 h-4" /></span>
                                     <p className="text-sm text-[var(--ink)] font-bold truncate flex-1 min-w-0">{qz.title || "اختبار المحاضرة"}</p>
                                     <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-500">اختبار</span>
                                   </div>
                                 ))}
                                 {f.homeworks?.map((hw) => (
                                   <div key={hw.id} className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                                     <span className="shrink-0 text-amber-500"><IconBook className="w-4 h-4" /></span>
                                     <div className="flex-1 min-w-0">
                                       <p className="text-sm text-[var(--ink)] font-bold truncate">{hw.title}</p>
                                       <p className="text-[10px] text-[var(--ink-muted)]">{hw.type === "exam" ? "واجب أسئلة" : hw.type === "terminal" ? "كود برمجي" : hw.type === "upload" ? "تسليم ملف" : "رابط"}</p>
                                     </div>
                                     <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">واجب</span>
                                     <button onClick={() => deleteHomeworkFromFolder(hw.id)} aria-label="حذف الواجب" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors">
                                       <IconTrash className="w-3.5 h-3.5" />
                                     </button>
                                   </div>
                                 ))}
                                 {f.materials?.map((m) => (
                                  <div key={m.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                                    <span className="shrink-0 text-[var(--ink-muted)]">{m.type === "pdf" ? <IconFile className="w-4 h-4" /> : <IconLink className="w-4 h-4" />}</span>
                                    <p className="text-sm text-[var(--ink)] font-medium truncate flex-1 min-w-0">{m.title}</p>
                                    <button onClick={() => deleteMaterial(m.id)} aria-label="حذف الملحق" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors">
                                      <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--ink-muted)] py-2">لا يوجد محتوى في هذه المحاضرة بعد.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add video + material */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Add video */}
                      <div className={cardPad}>
                        <h3 className="font-bold text-[var(--ink)] flex items-center gap-2"><IconVideo className="w-4 h-4 text-sky-500" /> إضافة فيديو</h3>
                        <p className="text-xs text-[var(--ink-muted)] mt-1 mb-4">اختر مزود الحماية ثم أدخل معرف الفيديو المناسب</p>
                        <form onSubmit={addVideo} className="space-y-3">
                          <select value={newVideo.folderId} onChange={(e) => setNewVideo({ ...newVideo, folderId: e.target.value })} className={input}>
                            <option value="">اختر المحاضرة</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <input type="text" value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} placeholder="عنوان الفيديو" className={input} />

                          {/* Provider selector */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              { value: "vdocipher", label: "VdoCipher", badge: "أعلى حماية DRM", level: "الأعلى أماناً" },
                              { value: "alasly", label: "Native", badge: "Super Native", level: "عالي" },
                              { value: "bunny", label: "Bunny CDN", badge: "حماية متوسطة", level: "متوسط" },
                              { value: "youtube", label: "YouTube", badge: "مجاني / اقتصادي", level: "منخفض التكلفة" },
                            ] as const).map(({ value, label: pl, badge, level }) => {
                              const active = newVideo.videoProvider === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setNewVideo({ ...newVideo, videoProvider: value, providerVideoId: "" })}
                                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                                    active ? "border-sky-500 bg-sky-500/10 text-sky-500 dark:text-sky-300 shadow-sm" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)]/40"
                                  }`}
                                >
                                  <IconShield className="w-4 h-4" />
                                  <span className="truncate w-full text-center">{pl}</span>
                                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-sky-500/20 text-sky-600 dark:text-sky-300" : "bg-[var(--border)]"}`}>{badge}</span>
                                  <span className="text-[8px] text-[var(--ink-muted)] font-normal">{level}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Provider ID */}
                          <div>
                            <label className={label}>
                              {newVideo.videoProvider === "vdocipher" && "VdoCipher Video ID — أعلى حماية مشفرة (Highest DRM)"}
                              {newVideo.videoProvider === "alasly" && "معرف درس Native — حماية عالية (Super Native Security)"}
                              {newVideo.videoProvider === "bunny" && "Bunny Stream Video GUID — حماية متوسطة (Medium CDN Security)"}
                              {newVideo.videoProvider === "youtube" && "YouTube Video ID (11 حرف) — مخصص للكورسات المجانية ومنخفضة التكلفة"}
                            </label>
                            <input
                              type="text"
                              value={newVideo.providerVideoId}
                              onChange={(e) => setNewVideo({ ...newVideo, providerVideoId: e.target.value.trim() })}
                              placeholder={newVideo.videoProvider === "vdocipher" ? "مثال: abc123def456" : newVideo.videoProvider === "bunny" ? "مثال: 12345678-abcd-…" : newVideo.videoProvider === "alasly" ? "أدخل معرف الدرس أو قم برفع الملف مباشرة أدناه" : "مثال: dQw4w9WgXcQ"}
                              dir="ltr"
                              className={`${input} font-mono`}
                            />

                            {/* Native Video SaaS Direct Upload Button */}
                            {newVideo.videoProvider === "alasly" && (
                              <div className="mt-2.5 p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <label className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                                    <span>⚡</span> رفع ملف فيديو مباشر إلى Native SaaS Engine:
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all cursor-pointer shrink-0">
                                    <span>📁 اختر فيديو من جهازك</span>
                                    <input
                                      type="file"
                                      accept="video/*"
                                      disabled={nativeUploading}
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleNativeFileUpload(file);
                                      }}
                                    />
                                  </label>
                                </div>

                                {nativeUploading && (
                                  <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-sky-400">
                                      <span>{nativeStatus}</span>
                                      <span className="font-mono">{nativeProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
                                      <div
                                        className="h-full bg-sky-500 transition-all duration-300"
                                        style={{ width: `${nativeProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="text-[10px] text-[var(--ink-muted)] mt-1.5">
                              {newVideo.videoProvider === "vdocipher" && "من لوحة VdoCipher ‹ Videos ‹ انسخ الـ ID (أعلى درجات الحماية ضد التحميل والتسريب)"}
                              {newVideo.videoProvider === "alasly" && "محمي بنظام Super Native Security بحماية عالية، مع علامات مائية متحركة وحماية ضد تسجيل الشاشة"}
                              {newVideo.videoProvider === "bunny" && "من Bunny Stream ‹ Library ‹ Video GUID (حماية متوسطة وسريعة)"}
                              {newVideo.videoProvider === "youtube" && "من رابط الفيديو: youtube.com/watch?v=الجزء (اقتصادي جداً للكورسات والمحاضرات المجانية)"}
                            </p>
                          </div>

                          {/* Duration */}
                          <div>
                            <label className={label}><IconClock className="w-3.5 h-3.5 inline -mt-0.5 me-1" />مدة الفيديو (دقائق) — لحساب نسبة الإنجاز</label>
                            <input type="number" min="0" step="1" value={newVideo.durationMinutes || ""} onChange={(e) => setNewVideo({ ...newVideo, durationMinutes: parseInt(e.target.value) || 0 })} placeholder="مثال: 45" className={input} dir="ltr" />
                          </div>

                          {/* Watches */}
                          <div>
                            <label className={label}><IconEye className="w-3.5 h-3.5 inline -mt-0.5 me-1" />عدد المشاهدات لكل طالب</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {[1, 2, 3, 5, 10].map((n) => (
                                <button key={n} type="button" onClick={() => setNewVideo({ ...newVideo, maxWatchesPerUser: n })}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${newVideo.maxWatchesPerUser === n ? "border-sky-500 bg-sky-500/10 text-sky-500 dark:text-sky-300" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)]/40"}`}>
                                  {n}×
                                </button>
                              ))}
                              <input type="number" min="1" max="99" value={newVideo.maxWatchesPerUser} onChange={(e) => setNewVideo({ ...newVideo, maxWatchesPerUser: Math.max(1, parseInt(e.target.value) || 1) })} className={`${input} w-16 text-center`} dir="ltr" />
                            </div>
                          </div>

                          {/* Scheduled unlock */}
                          <div>
                            <label className={label}><IconClock className="w-3.5 h-3.5 inline -mt-0.5 me-1" />موعد فتح الفيديو (اختياري)</label>
                            <div className="flex items-center gap-2">
                              <input type="datetime-local" value={newVideo.publishAt} onChange={(e) => setNewVideo({ ...newVideo, publishAt: e.target.value })} className={input} dir="ltr" />
                              {newVideo.publishAt && (
                                <button type="button" onClick={() => setNewVideo({ ...newVideo, publishAt: "" })} className="text-[11px] text-[var(--ink-muted)] hover:text-[var(--error)] shrink-0">مسح</button>
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--ink-muted)] mt-1">يظل الفيديو مقفلاً للطلاب حتى هذا الوقت. اتركه فارغاً ليكون متاحاً فوراً.</p>
                          </div>

                          <button type="submit" disabled={!newVideo.folderId || !newVideo.title || !newVideo.providerVideoId} className={`${primaryBtn} w-full`}>
                            <IconPlus className="w-4 h-4" /> إضافة الفيديو
                          </button>
                        </form>
                      </div>

                      {/* Add material */}
                      <div className={`${cardPad} h-fit`}>
                        <h3 className="font-bold text-[var(--ink)] mb-4 flex items-center gap-2"><IconFile className="w-4 h-4 text-sky-500" /> إضافة ملحق (PDF / رابط)</h3>
                        <form onSubmit={addMaterial} className="space-y-3">
                          <select value={newMaterial.folderId} onChange={(e) => setNewMaterial({ ...newMaterial, folderId: e.target.value })} className={input}>
                            <option value="">اختر المحاضرة</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <select value={newMaterial.type} onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })} className={input}>
                            <option value="pdf">ملف PDF (رابط)</option>
                            <option value="link">رابط خارجي</option>
                          </select>
                          <input type="text" value={newMaterial.title} onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })} placeholder="عنوان الملحق" className={input} />
                          <input type="url" value={newMaterial.url} onChange={(e) => setNewMaterial({ ...newMaterial, url: e.target.value })} placeholder="الرابط (URL)" dir="ltr" className={`${input} font-mono`} />
                          <button type="submit" disabled={!newMaterial.folderId || !newMaterial.title || !newMaterial.url} className={`${primaryBtn} w-full`}>
                            <IconPlus className="w-4 h-4" /> إضافة الملحق
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Add quiz */}
                    <div className={cardPad}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <h3 className="font-bold text-[var(--ink)] flex items-center gap-2"><IconClipboard className="w-4 h-4 text-sky-500" /> إضافة اختبار</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 text-xs font-bold transition-all cursor-pointer">
                            <span>📥 استيراد أسئلة من JSON</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleQuizJsonImport(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={downloadSampleQuizJson}
                            className="px-3 py-1.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs font-bold transition-all"
                          >
                            📄 تحميل قالب JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowJsonGuide(true)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-xs font-bold transition-all"
                          >
                            ❓ دليل صياغة JSON
                          </button>
                        </div>
                      </div>
                      <form onSubmit={addQuiz} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select value={newQuiz.folderId} onChange={(e) => setNewQuiz({ ...newQuiz, folderId: e.target.value })} className={input}>
                            <option value="">اختر المحاضرة</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <input type="text" value={newQuiz.title} onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })} placeholder="عنوان الاختبار" className={input} />
                          <input type="number" min={1} max={240} value={newQuiz.timeLimitMinutes} onChange={(e) => setNewQuiz({ ...newQuiz, timeLimitMinutes: Number(e.target.value) || 30 })} placeholder="المدة (دقائق)" className={input} dir="ltr" />
                        </div>

                        {newQuiz.questions.map((q, qi) => (
                          <div key={qi} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-[var(--ink)]">السؤال {qi + 1}</p>
                              <select
                                value={q.questionType || "mcq"}
                                onChange={(e) => {
                                  const qs = [...newQuiz.questions];
                                  qs[qi].questionType = e.target.value;
                                  setNewQuiz({ ...newQuiz, questions: qs });
                                }}
                                className={`${input} w-48 py-1 text-xs`}
                              >
                                <option value="mcq">اختيار من متعدد (MCQ)</option>
                                <option value="essay">سؤال مقالي (تصحيح يدوي)</option>
                              </select>
                            </div>
                            <input type="text" value={q.question} onChange={(e) => { const qs = [...newQuiz.questions]; qs[qi].question = e.target.value; setNewQuiz({ ...newQuiz, questions: qs }); }} placeholder="نص السؤال" className={input} />
                            
                            {/* Question image attachment */}
                            <div className="space-y-1.5 pt-1">
                              <label className={label}>صورة توضيحية للسؤال (مسألة / رسم بياني / شكل - اختياري)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={q.imageUrl || ""}
                                  onChange={(e) => { const qs = [...newQuiz.questions]; qs[qi].imageUrl = e.target.value; setNewQuiz({ ...newQuiz, questions: qs }); }}
                                  placeholder="رابط الصورة https://… أو اختر صورة من الجهاز"
                                  className={`${input} font-mono text-xs flex-1`}
                                  dir="ltr"
                                />
                                <label className={`${ghostBtn} cursor-pointer text-xs shrink-0 py-1.5`}>
                                  📷 رفع صورة
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const url = await fileToResizedDataUrl(file, 800);
                                          const qs = [...newQuiz.questions];
                                          qs[qi].imageUrl = url;
                                          setNewQuiz({ ...newQuiz, questions: qs });
                                        } catch {
                                          notify("error", "تعذر رفع الصورة");
                                        }
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              {q.imageUrl && (
                                <div className="mt-2 relative w-full max-w-sm rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] p-1">
                                  <img src={q.imageUrl} alt="توضيح السؤال" className="w-full max-h-40 object-contain rounded-lg" />
                                  <button
                                    type="button"
                                    onClick={() => { const qs = [...newQuiz.questions]; qs[qi].imageUrl = ""; setNewQuiz({ ...newQuiz, questions: qs }); }}
                                    className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold hover:bg-red-600 transition-colors shadow-sm"
                                  >
                                    مسح الصورة ✕
                                  </button>
                                </div>
                              )}
                            </div>

                            {q.questionType === "essay" ? (
                              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-600 dark:text-purple-300 font-bold flex items-center gap-2">
                                <span>📝 سؤال مقالي:</span>
                                <span>يكتب الطالب إجابة نصية حرة وتظهر لك في لوحة المعلم لمراجعتها وتصحيحها ورصد الدرجات.</span>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(["A", "B", "C", "D"] as const).map((opt) => {
                                    const optKey = `option${opt}` as "optionA" | "optionB" | "optionC" | "optionD";
                                    return (
                                      <div key={opt} className="flex gap-2 items-center">
                                        <button
                                          type="button"
                                          onClick={() => { const qs = [...newQuiz.questions]; qs[qi].correctAnswer = opt; setNewQuiz({ ...newQuiz, questions: qs }); }}
                                          aria-label={`تعيين ${opt} كإجابة صحيحة`}
                                          className={`shrink-0 w-7 h-7 rounded-lg text-xs font-bold transition-colors ${q.correctAnswer === opt ? "bg-emerald-500 text-white" : "bg-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                                        >
                                          {opt}
                                        </button>
                                        <input
                                          type="text"
                                          value={q[optKey] || ""}
                                          onChange={(e) => {
                                            const qs = [...newQuiz.questions];
                                            qs[qi][optKey] = e.target.value;
                                            setNewQuiz({ ...newQuiz, questions: qs });
                                          }}
                                          placeholder={`الخيار ${opt}`}
                                          className={input}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] text-[var(--ink-muted)]">اضغط على حرف الخيار لتحديده كإجابة صحيحة. الحالي: <span className="font-bold text-emerald-500">{q.correctAnswer}</span></p>
                              </>
                            )}
                          </div>
                        ))}

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button type="button" onClick={() => setNewQuiz({ ...newQuiz, questions: [...newQuiz.questions, { question: "", questionType: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }] })} className={ghostBtn}>
                            <IconPlus className="w-4 h-4" /> سؤال جديد
                          </button>
                          <button type="submit" disabled={!newQuiz.folderId || !newQuiz.title} className={`${primaryBtn} flex-1`}>
                            إضافة الاختبار
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Add Homework to Folder card */}
                    <div className={cardPad}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
                        <div>
                          <h3 className="font-bold text-[var(--ink)] flex items-center gap-2">
                            <IconBook className="w-4 h-4 text-amber-500" /> إضافة واجب للمحاضرة
                          </h3>
                          <p className="text-xs text-[var(--ink-muted)] mt-0.5">يمكنك ربط الواجب بمحاضرة محددة أو فيديو وإضافة أسئلة MCQ أو ملفات</p>
                        </div>
                        {newFolderHomework.type === "exam" && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold transition-all cursor-pointer">
                              <span>📥 استيراد أسئلة من JSON</span>
                              <input
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFolderHwJsonImport(file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowJsonGuide(true)}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-xs font-bold transition-all"
                            >
                              ❓ دليل صياغة JSON
                            </button>
                          </div>
                        )}
                      </div>

                      <form onSubmit={addHomeworkToFolder} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={newFolderHomework.folderId}
                            onChange={(e) => setNewFolderHomework({ ...newFolderHomework, folderId: e.target.value })}
                            className={input}
                          >
                            <option value="">اختر المحاضرة *</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <input
                            type="text"
                            value={newFolderHomework.title}
                            onChange={(e) => setNewFolderHomework({ ...newFolderHomework, title: e.target.value })}
                            placeholder="عنوان الواجب *"
                            className={input}
                          />
                          <select
                            value={newFolderHomework.type}
                            onChange={(e) => setNewFolderHomework({ ...newFolderHomework, type: e.target.value as any })}
                            className={input}
                          >
                            <option value="exam">📝 اختبار أسئلة MCQ</option>
                            <option value="terminal">💻 كود برمجي / Terminal</option>
                            <option value="upload">📎 رفع وتكليف ملفات</option>
                            <option value="link">🔗 رابط خارجي</option>
                          </select>
                        </div>

                        {newFolderHomework.type === "link" && (
                          <input
                            type="url"
                            value={newFolderHomework.linkUrl}
                            onChange={(e) => setNewFolderHomework({ ...newFolderHomework, linkUrl: e.target.value })}
                            placeholder="رابط الواجب https://..."
                            className={input}
                            dir="ltr"
                          />
                        )}

                        {newFolderHomework.type === "exam" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className={label}>أسئلة الواجب ({newFolderHomework.questions.length})</label>
                              <input
                                type="number"
                                min={1}
                                max={240}
                                value={newFolderHomework.timeLimitMinutes}
                                onChange={(e) => setNewFolderHomework({ ...newFolderHomework, timeLimitMinutes: Number(e.target.value) || 30 })}
                                placeholder="الوقت المحدد (دقائق)"
                                className={`${input} w-40 text-xs`}
                                dir="ltr"
                              />
                            </div>
                            {newFolderHomework.questions.map((q, qi) => (
                              <div key={qi} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-bold text-[var(--ink)]">السؤال {qi + 1}</p>
                                </div>
                                <input
                                  type="text"
                                  value={q.question}
                                  onChange={(e) => {
                                    const qs = [...newFolderHomework.questions];
                                    qs[qi].question = e.target.value;
                                    setNewFolderHomework({ ...newFolderHomework, questions: qs });
                                  }}
                                  placeholder="نص السؤال"
                                  className={input}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(["A", "B", "C", "D"] as const).map((opt) => {
                                    const optKey = `option${opt}` as "optionA" | "optionB" | "optionC" | "optionD";
                                    return (
                                      <div key={opt} className="flex gap-2 items-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const qs = [...newFolderHomework.questions];
                                            qs[qi].correctAnswer = opt;
                                            setNewFolderHomework({ ...newFolderHomework, questions: qs });
                                          }}
                                          className={`shrink-0 w-7 h-7 rounded-lg text-xs font-bold transition-colors ${q.correctAnswer === opt ? "bg-amber-500 text-white" : "bg-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                                        >
                                          {opt}
                                        </button>
                                        <input
                                          type="text"
                                          value={q[optKey] || ""}
                                          onChange={(e) => {
                                            const qs = [...newFolderHomework.questions];
                                            qs[qi][optKey] = e.target.value;
                                            setNewFolderHomework({ ...newFolderHomework, questions: qs });
                                          }}
                                          placeholder={`الخيار ${opt}`}
                                          className={input}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setNewFolderHomework({ ...newFolderHomework, questions: [...newFolderHomework.questions, { question: "", imageUrl: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" }] })}
                              className={ghostBtn}
                            >
                              <IconPlus className="w-4 h-4" /> سؤال جديد للواجب
                            </button>
                          </div>
                        )}

                        <button type="submit" disabled={!newFolderHomework.folderId || !newFolderHomework.title} className={`${primaryBtn} w-full`}>
                          إضافة الواجب للمحاضرة
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* ── SETTINGS TAB ── */}
                {courseTab === "settings" && (
                  <div className={cardPad}>
                    <h3 className="font-bold text-[var(--ink)] mb-4 flex items-center gap-2"><IconSettings className="w-4 h-4 text-sky-500" /> إعدادات الكورس</h3>
                    <form onSubmit={saveCourseSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={label}>عنوان الكورس</label>
                        <input type="text" value={courseSettings.title} onChange={(e) => setCourseSettings({ ...courseSettings, title: e.target.value })} className={input} />
                      </div>
                      <div>
                        <label className={label}>المادة</label>
                        <input type="text" value={courseSettings.subject} onChange={(e) => setCourseSettings({ ...courseSettings, subject: e.target.value })} className={input} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={label}>المرحلة التدريبية *</label>
                        <select value={courseSettings.educationalStage} onChange={(e) => setCourseSettings({ ...courseSettings, educationalStage: e.target.value })} className={input}>
                          <option value="">اختر المرحلة</option>
                          <option value="sec_1">أولى بكالوريا (sec_1)</option>
                          <option value="sec_2">ثانية بكالوريا (sec_2)</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className={label}>الصورة المصغرة (رابط أو رفع من الجهاز)</label>
                        <div className="flex gap-2">
                          <input type="text" value={courseSettings.thumbnailUrl} onChange={(e) => setCourseSettings({ ...courseSettings, thumbnailUrl: e.target.value })} placeholder="https://…" dir="ltr" className={`${input} font-mono flex-1`} />
                          <label className={`${ghostBtn} cursor-pointer shrink-0`}>
                            رفع صورة
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const url = await fileToResizedDataUrl(file, 600);
                                  setCourseSettings({ ...courseSettings, thumbnailUrl: url });
                                } catch (err) {
                                  notify("error", "تعذر معالجة الصورة");
                                }
                              }
                            }} />
                          </label>
                        </div>
                        {courseSettings.thumbnailUrl && courseSettings.thumbnailUrl.startsWith("data:image") && (
                          <div className="mt-2 w-32 h-16 rounded overflow-hidden border border-[var(--border)]">
                            <img src={courseSettings.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">الأبعاد المثالية: 600×300 بكسل (نسبة 2:1)</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className={label}>وصف الكورس</label>
                        <textarea rows={3} value={courseSettings.description} onChange={(e) => setCourseSettings({ ...courseSettings, description: e.target.value })} className={`${input} resize-none`} />
                      </div>
                      <div>
                        <label className={label}>المشاهدات الافتراضية لكل طالب</label>
                        <input type="number" min={1} max={99} value={courseSettings.maxWatchCount} onChange={(e) => setCourseSettings({ ...courseSettings, maxWatchCount: Number(e.target.value) || 3 })} className={input} dir="ltr" />
                      </div>
                      <div>
                        <label className={label}>رابط صفحة الواجب المنزلي</label>
                        <input type="url" value={courseSettings.homeworkUrl} onChange={(e) => setCourseSettings({ ...courseSettings, homeworkUrl: e.target.value })} placeholder="https://…" dir="ltr" className={`${input} font-mono`} />
                      </div>

                      {/* Video access order */}
                      <div className="md:col-span-2">
                        <label className={label}>ترتيب مشاهدة الدروس</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => setCourseSettings({ ...courseSettings, sequentialAccess: true })}
                            className={`flex-1 text-right p-3 rounded-xl border-2 transition-all ${courseSettings.sequentialAccess ? "border-sky-500 bg-sky-500/10" : "border-[var(--border)] hover:border-[var(--ink-muted)]/40"}`}
                          >
                            <span className={`block text-sm font-bold ${courseSettings.sequentialAccess ? "text-sky-500 dark:text-sky-300" : "text-[var(--ink)]"}`}>🔒 إجباري بالترتيب</span>
                            <span className="block text-[11px] text-[var(--ink-muted)] mt-0.5">يُقفل الدرس حتى إكمال الذي قبله</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCourseSettings({ ...courseSettings, sequentialAccess: false })}
                            className={`flex-1 text-right p-3 rounded-xl border-2 transition-all ${!courseSettings.sequentialAccess ? "border-sky-500 bg-sky-500/10" : "border-[var(--border)] hover:border-[var(--ink-muted)]/40"}`}
                          >
                            <span className={`block text-sm font-bold ${!courseSettings.sequentialAccess ? "text-sky-500 dark:text-sky-300" : "text-[var(--ink)]"}`}>🔓 مشاهدة حرة</span>
                            <span className="block text-[11px] text-[var(--ink-muted)] mt-0.5">يستطيع الطالب فتح أي درس في أي وقت</span>
                          </button>
                        </div>
                      </div>

                      <button type="submit" className={`${primaryBtn} md:col-span-2`}>حفظ الإعدادات</button>
                    </form>
                  </div>
                )}

                {/* ── PRICING TAB ── */}
                {courseTab === "pricing" && (
                  <div className={cardPad}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="font-bold text-[var(--ink)] flex items-center gap-2"><IconTag className="w-4 h-4 text-sky-500" /> تسعير الكورس</h3>
                      {selectedCourse?.educationalStage && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                          🎓 المرحلة: {selectedCourse.educationalStage === "sec_1" ? "أولى بكالوريا" : selectedCourse.educationalStage === "sec_2" ? "ثانية بكالوريا" : selectedCourse.educationalStage}
                        </span>
                      )}
                    </div>
                    <form onSubmit={savePricingSettings} className="space-y-4 max-w-xl">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setPricingSettings({ ...pricingSettings, isPaid: false })}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${!pricingSettings.isPaid ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)]/40"}`}>
                          مجاني
                        </button>
                        <button type="button" onClick={() => setPricingSettings({ ...pricingSettings, isPaid: true })}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${pricingSettings.isPaid ? "bg-sky-500 border-sky-500 text-white" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)]/40"}`}>
                          مدفوع
                        </button>
                      </div>

                      {/* Install button toggle — free courses only */}
                      {!pricingSettings.isPaid && (
                        <button
                          type="button"
                          onClick={() => setPricingSettings({ ...pricingSettings, allowDirectInstall: !pricingSettings.allowDirectInstall })}
                          className="w-full flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors text-right"
                          style={{
                            borderColor: pricingSettings.allowDirectInstall ? "var(--brand)" : "var(--border)",
                            background:  pricingSettings.allowDirectInstall ? "var(--brand-soft)" : "var(--surface-2)",
                            color:       pricingSettings.allowDirectInstall ? "var(--brand)" : "var(--ink-2)",
                          }}
                        >
                          <span
                            className="w-10 h-6 rounded-full transition-colors flex items-center shrink-0"
                            style={{ background: pricingSettings.allowDirectInstall ? "var(--brand)" : "var(--border)", padding: 2 }}
                          >
                            <span
                              className="w-4 h-4 bg-white rounded-full shadow transition-transform"
                              style={{ transform: pricingSettings.allowDirectInstall ? "translateX(-16px)" : "translateX(0)" }}
                            />
                          </span>
                          <div className="flex-1 text-right">
                            <div>تفعيل زر "تثبيت الكورس" 📲</div>
                            <div className="text-xs font-normal mt-0.5" style={{ color: "var(--ink-3)" }}>
                              {pricingSettings.allowDirectInstall
                                ? "الطلاب يرون زر تثبيت مباشر بدون كود"
                                : "الطلاب يحتاجون كود وصول للتسجيل"}
                            </div>
                          </div>
                        </button>
                      )}

                      {pricingSettings.isPaid && (
                        <div>
                          <label className={label}>السعر الأصلي (جنيه) *</label>
                          <input type="number" min={0} step={0.01} value={pricingSettings.price} onChange={(e) => setPricingSettings({ ...pricingSettings, price: e.target.value })} placeholder="مثال: 150" className={input} dir="ltr" />
                        </div>
                      )}

                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
                        <p className="text-xs font-bold text-[var(--ink)]">خصم محدود المدة (اختياري)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={label}>نسبة الخصم %</label>
                            <input type="number" min={0} max={100} step={1} value={pricingSettings.discountPercent} onChange={(e) => setPricingSettings({ ...pricingSettings, discountPercent: e.target.value })} placeholder="مثال: 20" className={input} dir="ltr" />
                          </div>
                          <div>
                            <label className={label}>تاريخ انتهاء العرض</label>
                            <input type="datetime-local" value={pricingSettings.discountExpiresAt} onChange={(e) => setPricingSettings({ ...pricingSettings, discountExpiresAt: e.target.value })} className={input} dir="ltr" />
                          </div>
                        </div>
                        {pricingSettings.discountPercent && pricingSettings.isPaid && pricingSettings.price && (
                          <p className="text-xs text-[var(--ink-muted)]">السعر بعد الخصم: <strong className="text-emerald-500">{(parseFloat(pricingSettings.price) * (1 - parseFloat(pricingSettings.discountPercent) / 100)).toFixed(2)} جنيه</strong></p>
                        )}
                        {pricingSettings.discountPercent && !pricingSettings.isPaid && (
                          <p className="text-xs text-amber-500">الخصم يُطبق فقط على الكورسات المدفوعة.</p>
                        )}
                      </div>

                      <button type="submit" disabled={savingPricing} className={`${primaryBtn} w-full`}>
                        {savingPricing ? "جارٍ الحفظ…" : "حفظ إعدادات التسعير"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          )}

          {/* ════════ CREATE COURSE ════════ */}
          {activeSection === "create-course" && (
            <div className="max-w-2xl">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-[var(--ink)] mb-1.5">إنشاء كورس جديد</h2>
                <p className="text-sm text-[var(--ink-muted)] leading-7">املأ بيانات الكورس مرة واحدة وسيظهر مباشرة في لوحة المعلم والواجهة العامة.</p>
              </div>
              <form onSubmit={createCourse} className={`${cardPad} space-y-4`}>
                <div>
                  <label className={label}>عنوان الكورس *</label>
                  <input type="text" required value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} placeholder="رياضيات ثالث ثانوي" className={input} />
                </div>
                <div>
                  <label className={label}>المادة *</label>
                  <select required value={newCourse.subject} onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })} className={input}>
                    <option value="">اختر المادة</option>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>المرحلة التدريبية *</label>
                  <select required value={newCourse.educationalStage} onChange={(e) => setNewCourse({ ...newCourse, educationalStage: e.target.value })} className={input}>
                    <option value="">اختر المرحلة</option>
                    {EDUCATIONAL_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>الصورة المصغرة (رابط أو رفع من الجهاز)</label>
                  <div className="flex gap-2">
                    <input type="text" value={newCourse.thumbnailUrl} onChange={(e) => setNewCourse({ ...newCourse, thumbnailUrl: e.target.value })} placeholder="https://example.com/image.jpg" dir="ltr" className={`${input} font-mono flex-1`} />
                    <label className={`${ghostBtn} cursor-pointer shrink-0`}>
                      رفع صورة
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await fileToResizedDataUrl(file, 600);
                            setNewCourse({ ...newCourse, thumbnailUrl: url });
                          } catch (err) {
                            notify("error", "تعذر معالجة الصورة");
                          }
                        }
                      }} />
                    </label>
                  </div>
                  {newCourse.thumbnailUrl && newCourse.thumbnailUrl.startsWith("data:image") && (
                    <div className="mt-2 w-32 h-16 rounded overflow-hidden border border-[var(--border)]">
                      <img src={newCourse.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">الأبعاد المثالية: 600×300 بكسل (نسبة 2:1)</p>
                </div>
                <div>
                  <label className={label}>وصف الكورس</label>
                  <textarea rows={3} value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} placeholder="وصف مختصر للكورس…" className={`${input} resize-none`} />
                </div>
                <button type="submit" disabled={creatingCourse} className={`${primaryBtn} w-full py-3`}>
                  {creatingCourse ? "جارٍ إنشاء الكورس…" : "إنشاء الكورس"}
                </button>
              </form>
            </div>
          )}

          {/* ════════ CODES ════════ */}
          {activeSection === "codes" && (
            <div className="space-y-5">
              {/* Category Switcher Tab */}
              <div className="flex gap-2 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] w-full sm:w-fit">
                <button
                  onClick={() => { setCodeCategory("courses"); setSelectedPlan(null); }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    codeCategory === "courses" ? "bg-sky-500 text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  📚 أكواد الكورسات
                </button>
                <button
                  onClick={() => { setCodeCategory("plans"); setSelectedCourse(null); }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    codeCategory === "plans" ? "bg-emerald-600 text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  🎓 أكواد الخطط والاشتراكات
                </button>
              </div>

              {/* COURSE CODES CATEGORY */}
              {codeCategory === "courses" && (
                !selectedCourse ? (
                  <CoursePicker courses={courses} onSelect={(c) => { setSelectedCourse(c); fetchCodes(c.id, false); }} hint="اختر كورساً لإدارة أكواده:" sub={(c) => `${c._count?.accessCodes || 0} كود`} />
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setSelectedCourse(null)} className="text-xs font-bold text-sky-500 hover:underline me-2">← تغيير الكورس</button>
                      <h2 className="font-bold text-[var(--ink)] me-auto">{selectedCourse.title} — الأكواد</h2>
                      {[1, 5, 10].map((n) => (
                        <button key={n} onClick={() => generateCodes(selectedCourse.id, n, false)} className={ghostBtn}>
                          <IconPlus className="w-4 h-4" /> {n}
                        </button>
                      ))}
                    </div>

                    {/* Bulk generate panel */}
                    <div className={`${cardPad} space-y-4`}>
                      <h3 className="font-bold text-[var(--ink)] text-xs flex items-center gap-2">
                        <IconKey className="w-4 h-4 text-sky-500" />
                        <span>توليد أكواد بكميات كبيرة (تحميل ملف CSV)</span>
                      </h3>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-24 shrink-0">
                          <label className={label}>عدد الأكواد</label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={bulkCount}
                            onChange={(e) => setBulkCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                            className={input}
                          />
                        </div>
                        <div className="w-36 shrink-0">
                          <label className={label}>البادئة (اختياري)</label>
                          <input
                            type="text"
                            placeholder="مثال: MATH"
                            maxLength={10}
                            value={bulkPrefix}
                            onChange={(e) => setBulkPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                            className={input}
                            dir="ltr"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={bulkGenerating}
                          onClick={handleBulkGenerate}
                          className={primaryBtn}
                        >
                          {bulkGenerating ? "جارٍ التوليد..." : "إنشاء وتحميل CSV"}
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--ink-muted)]">
                        يمكنك توليد حتى 200 كود دفعة واحدة ببادئة مخصصة. سيتم تحميل ملف يحتوي على الأكواد الناتجة مباشرة.
                      </p>
                    </div>

                    <div className={`${card} overflow-hidden`}>
                      {codes.length === 0 ? (
                        <EmptyState icon={<IconKey className="w-7 h-7" />} title="لا توجد أكواد بعد" hint="أنشئ أكواداً من الأزرار بالأعلى لتوزيعها على الطلاب." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="text-xs text-[var(--ink-muted)] border-b border-[var(--border)]">
                                <th className="text-start font-semibold px-4 py-3">الكود</th>
                                <th className="text-start font-semibold px-4 py-3">المتعلم</th>
                                <th className="text-start font-semibold px-4 py-3">الحالة</th>
                                <th className="text-start font-semibold px-4 py-3">إجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {codes.map((c) => (
                                <tr key={c.id}>
                                  <td className="px-4 py-3 font-mono text-sky-500 dark:text-sky-300 text-xs" dir="ltr">{c.code}</td>
                                  <td className="px-4 py-3 text-[var(--ink)] truncate max-w-[140px]">{c.student?.name || "—"}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${!c.student ? (c.isActive ? "text-emerald-500" : "text-[var(--ink-muted)]") : c.isActive ? "text-emerald-500" : "text-[var(--error)]"}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${!c.student ? (c.isActive ? "bg-emerald-500" : "bg-[var(--ink-muted)]") : c.isActive ? "bg-emerald-500" : "bg-[var(--error)]"}`} />
                                      {!c.student ? (c.isActive ? "متاح" : "معطل") : c.isActive ? "مسجل" : "محظور"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button onClick={() => toggleCode(c.id, !c.isActive, false)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${c.isActive ? "text-[var(--error)] hover:bg-[var(--error)]/10" : "text-emerald-500 hover:bg-emerald-500/10"}`}>
                                      {c.isActive ? "تعطيل" : "تفعيل"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* PLAN CODES CATEGORY */}
              {codeCategory === "plans" && (
                !selectedPlan ? (
                  <div className={`${card} overflow-hidden p-5 space-y-4`}>
                    <h3 className="font-bold text-[var(--ink)] text-sm">اختر خطة دراسية أو اشتراكاً لإدارة أكواده:</h3>
                    {plans.length === 0 ? (
                      <EmptyState icon={<IconBook className="w-7 h-7" />} title="لا توجد خطط منشورة" hint="تواصل مع إدارة المنصة لنشر الخطط الدراسية." />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {plans.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPlan(p); fetchCodes(p.id, true); }}
                            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-right transition-all hover:border-emerald-500 hover:shadow-md cursor-pointer"
                          >
                            <div className="font-bold text-sm text-[var(--ink)]">{p.title}</div>
                            <div className="text-xs text-[var(--ink-muted)] mt-1 flex justify-between">
                              <span>المرحلة: {p.educationalStage}</span>
                              <span className="font-bold text-emerald-500">{p.price} جنيه</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setSelectedPlan(null)} className="text-xs font-bold text-emerald-500 hover:underline me-2">← تغيير الخطة</button>
                      <h2 className="font-bold text-[var(--ink)] me-auto">{selectedPlan.title} — أكواد الاشتراك</h2>
                      {[1, 5, 10].map((n) => (
                        <button key={n} onClick={() => generateCodes(selectedPlan.id, n, true)} className={ghostBtn}>
                          <IconPlus className="w-4 h-4" /> {n}
                        </button>
                      ))}
                    </div>

                    {/* Bulk generate panel */}
                    <div className={`${cardPad} space-y-4`}>
                      <h3 className="font-bold text-[var(--ink)] text-xs flex items-center gap-2">
                        <IconKey className="w-4 h-4 text-emerald-500" />
                        <span>توليد أكواد اشتراك بكميات كبيرة (تحميل ملف CSV)</span>
                      </h3>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-24 shrink-0">
                          <label className={label}>عدد الأكواد</label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={bulkCount}
                            onChange={(e) => setBulkCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                            className={input}
                          />
                        </div>
                        <div className="w-36 shrink-0">
                          <label className={label}>البادئة (اختياري)</label>
                          <input
                            type="text"
                            placeholder="مثال: SUB"
                            maxLength={10}
                            value={bulkPrefix}
                            onChange={(e) => setBulkPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                            className={input}
                            dir="ltr"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={bulkGenerating}
                          onClick={handleBulkGenerate}
                          className={`${primaryBtn} bg-emerald-600 hover:bg-emerald-500`}
                        >
                          {bulkGenerating ? "جارٍ التوليد..." : "إنشاء وتحميل CSV"}
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--ink-muted)]">
                        سيتم توليد أكواد تفعيل وتنزيل ملف CSV جاهز لطباعته وتوزيعه على الطلاب مباشرة.
                      </p>
                    </div>

                    <div className={`${card} overflow-hidden`}>
                      {codes.length === 0 ? (
                        <EmptyState icon={<IconKey className="w-7 h-7" />} title="لا توجد أكواد بعد" hint="أنشئ أكواد اشتراك من الأزرار بالأعلى لتوزيعها على الطلاب." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="text-xs text-[var(--ink-muted)] border-b border-[var(--border)]">
                                <th className="text-start font-semibold px-4 py-3">كود الاشتراك</th>
                                <th className="text-start font-semibold px-4 py-3">المستخدم</th>
                                <th className="text-start font-semibold px-4 py-3">الحالة</th>
                                <th className="text-start font-semibold px-4 py-3">إجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {codes.map((c: any) => (
                                <tr key={c.id}>
                                  <td className="px-4 py-3 font-mono text-emerald-500 text-xs font-bold" dir="ltr">{c.code}</td>
                                  <td className="px-4 py-3 text-[var(--ink)] truncate max-w-[140px]">{c.usedById ? "تم الاستخدام" : "—"}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${!c.usedById ? (c.isActive ? "text-emerald-500" : "text-[var(--ink-muted)]") : "text-amber-500"}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${!c.usedById ? (c.isActive ? "bg-emerald-500" : "bg-[var(--ink-muted)]") : "bg-amber-500"}`} />
                                      {!c.usedById ? (c.isActive ? "متاح" : "معطل") : "مستخدَم"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button onClick={() => toggleCode(c.id, !c.isActive, true)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${c.isActive ? "text-[var(--error)] hover:bg-[var(--error)]/10" : "text-emerald-500 hover:bg-emerald-500/10"}`}>
                                      {c.isActive ? "تعطيل" : "تفعيل"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ════════ STUDENTS ════════ */}
          {activeSection === "students" && (
            !selectedCourse ? (
              <CoursePicker courses={courses} onSelect={(c) => selectCourse(c, "students")} hint="اختر كورساً لعرض طلابه:" sub={(c) => `${c._count?.accessCodes || 0} طالب مسجل`} />
            ) : (
              <div className="space-y-5">
                <h2 className="font-bold text-[var(--ink)]">{selectedCourse.title} — المتعلمين</h2>
                <div className={`${card} overflow-hidden`}>
                  {codes.filter((c) => c.student).length === 0 ? (
                    <EmptyState icon={<IconUsers className="w-7 h-7" />} title="لا يوجد طلاب مسجلون بعد" hint="سيظهر الطلاب هنا فور تفعيلهم لأكواد هذا الكورس." />
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {codes.filter((c) => c.student).map((c) => (
                        <li key={c.id} className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-500 dark:text-sky-300 flex items-center justify-center text-sm font-black shrink-0">
                              {c.student!.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--ink)] text-sm truncate">{c.student!.name}</p>
                              <p className="text-xs text-[var(--ink-muted)] truncate">{c.student!.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.isActive ? "bg-emerald-500/12 text-emerald-500" : "bg-[var(--error)]/12 text-[var(--error)]"}`}>
                              {c.isActive ? "نشط" : "محظور"}
                            </span>
                            <button type="button" onClick={() => resetDevices(c.student!.id, c.student!.name)}
                              title="مسح أجهزة الطالب ليتمكن من الدخول من جهاز جديد"
                              className="px-2.5 py-1 text-xs font-bold rounded-lg text-sky-500 hover:bg-sky-500/10 transition-colors">
                              تصفير الأجهزة
                            </button>
                            <button type="button" onClick={() => updateStudentAccess(c.student!.id, c.isActive ? "ban" : "unban")}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${c.isActive ? "text-[var(--error)] hover:bg-[var(--error)]/10" : "text-emerald-500 hover:bg-emerald-500/10"}`}>
                              {c.isActive ? "حظر" : "إلغاء الحظر"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          )}

          {activeSection === "quiz-results" && <TeacherQuizResults />}
          {activeSection === "requests" && <TeacherRequests />}
          {activeSection === "feedback" && <TeacherFeedback />}

          {/* ════════ HOMEWORK MANAGEMENT ════════ */}
          {activeSection === "homework" && (
            <HomeworkManagerSection
              courses={courses}
              folders={folders}
              selectedCourse={selectedCourse}
              onSelectCourse={(c) => selectCourse(c, "courses")}
              notify={notify}
            />
          )}

          {/* ════════ LIVE REVIEW PANEL ════════ */}
          {activeSection === "review" && (
            <LiveReviewPanel notify={notify} />
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => { confirmState?.resolve(true); setConfirmState(null); }}
        onCancel={() => { confirmState?.resolve(false); setConfirmState(null); }}
      />

      {showJsonGuide && <JSONGuideModal onClose={() => setShowJsonGuide(false)} notify={notify} />}
    </div>
  );
}

function JSONGuideModal({ onClose, notify }: { onClose: () => void; notify: (type: "success" | "error", text: string) => void }) {
  const fullExamSample = {
    title: "اختبار شهر أكتوبر في الفيزياء",
    timeLimitMinutes: 30,
    questions: [
      {
        question: "ما هي وحدة قياس القوة في النظام الدولي؟",
        questionType: "mcq",
        imageUrl: "https://example.com/image.png",
        optionA: "النيوتن",
        optionB: "الجول",
        optionC: "الفولت",
        optionD: "الواط",
        correctAnswer: "A"
      },
      {
        question: "اشرح قانون نيوتن الأول وتطبيقاته باختصار",
        "questionType": "essay"
      }
    ]
  };

  const arrayQuestionsSample = [
    {
      question: "ما الفرق بين السرعة القياسية والسرعة المتجهة؟",
      optionA: "السرعة المتجهة تتضمن الاتجاه والقياسية لا تتضمنه",
      optionB: "لا يوجد فرق بينهما",
      optionC: "السرعة القياسية أسرع دائماً",
      optionD: "السرعة المتجهة تُقاس بالفولت",
      correctAnswer: "A"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 space-y-5 text-right max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
            <span>💡 دليل وتنسيق صياغة ملف الـ JSON</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg font-bold p-1">✕</button>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-[var(--ink-muted)]">
          <p className="text-sm font-semibold text-[var(--ink)]">
            يمكنك إعداد الأسئلة في أي محرر نصوص أو عبر برامج الذكاء الاصطناعي (مثل ChatGPT) وحفظ الملف بصيغة <code className="bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-mono">.json</code> بأحد التنسيقين التاليين:
          </p>

          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400">1️⃣ استيراد اختبار/واجب كامل (عنوان + وقت + أسئلة):</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(fullExamSample, null, 2));
                  notify("success", "تم نسخ كود الـ JSON إلى الحافظة 📋");
                }}
                className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-[11px] font-bold"
              >
                📋 نسخ النموذج
              </button>
            </div>
            <pre className="font-mono text-[11px] text-emerald-400 bg-black/40 p-3 rounded-lg overflow-x-auto text-left" dir="ltr">
{JSON.stringify(fullExamSample, null, 2)}
            </pre>
          </div>

          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400">2️⃣ استيراد قائمة أسئلة مباشرة (Array of Questions):</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(arrayQuestionsSample, null, 2));
                  notify("success", "تم نسخ كود الـ JSON إلى الحافظة 📋");
                }}
                className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-[11px] font-bold"
              >
                📋 نسخ النموذج
              </button>
            </div>
            <pre className="font-mono text-[11px] text-emerald-400 bg-black/40 p-3 rounded-lg overflow-x-auto text-left" dir="ltr">
{JSON.stringify(arrayQuestionsSample, null, 2)}
            </pre>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-500 space-y-1">
            <p className="font-bold">⚠️ قواعد وإرشادات صياغة الـ JSON:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>حدد الإجابة الصحيحة في <code className="font-mono font-bold">correctAnswer</code> بأحد الحروف: <code className="font-mono">"A"</code> أو <code className="font-mono">"B"</code> أو <code className="font-mono">"C"</code> أو <code className="font-mono">"D"</code>.</li>
              <li>للأسئلة المقالية (التي تتطلب تصحيحاً كتابياً بدلاً من التلقائي): اجعل <code className="font-mono font-bold">"questionType": "essay"</code>.</li>
              <li>الصورة التوضيحية <code className="font-mono font-bold">imageUrl</code> اختيارية ويمكن تركها فارغة <code className="font-mono">""</code> أو وضع رابط مباشر <code className="font-mono">"https://..."</code>.</li>
            </ul>
          </div>
        </div>

        <div className="pt-2 text-left">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs">
            فهمت، إغلاق الدليل
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Local presentational helpers ──────────────────────────────────────────────

function CourseThumb({ course }: { course: Course }) {
  if (course.thumbnailUrl) {
    return <Image src={course.thumbnailUrl} alt={course.title} width={48} height={48} className="w-12 h-12 rounded-xl object-cover shrink-0" unoptimized />;
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-sky-500/12 text-sky-500 dark:text-sky-300 flex items-center justify-center shrink-0">
      <IconBook className="w-5 h-5" />
    </div>
  );
}

function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="mx-auto mb-4 w-14 h-14 rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink-muted)] flex items-center justify-center">
        {icon}
      </div>
      <p className="font-bold text-[var(--ink)]">{title}</p>
      {hint && <p className="text-sm text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto leading-6">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

function CoursePicker({ courses, onSelect, hint, sub }: { courses: Course[]; onSelect: (c: Course) => void; hint: string; sub: (c: Course) => string }) {
  if (courses.length === 0) {
    return (
      <div className={cardPad}>
        <EmptyState icon={<IconBook className="w-7 h-7" />} title="لا توجد كورسات" hint="أنشئ كورساً أولاً." />
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-[var(--ink-muted)] mb-4">{hint}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courses.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)} className={`${cardPad} text-right hover:border-sky-400/50 transition-colors`}>
            <p className="font-bold text-[var(--ink)] truncate">{c.title}</p>
            <p className="text-sm text-[var(--ink-muted)] mt-0.5">{sub(c)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
