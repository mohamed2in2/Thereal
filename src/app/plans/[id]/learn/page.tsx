"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoSource = {
  id: string;
  isDefault: boolean;
  video?: {
    id: string;
    title: string;
    durationMinutes: number;
    folder?: {
      courseId: string;
    };
  };
};

type Quiz = {
  id: string;
  title: string;
};

type Lesson = {
  id: string;
  title: string;
  order: number;
  unlocked: boolean;
  requiresQuiz: boolean;
  requiresHomework: boolean;
  hasProject: boolean;
  sources: VideoSource[];
  quizzes: Quiz[];
  homeworks: Array<{ id: string; title: string; content?: string }>;
  progress: {
    watched: boolean;
    chosenSourceId?: string | null;
    quizPassed: boolean;
    quizScore?: number | null;
    homeworkPassed: boolean;
    projectPassed: boolean;
    projectGrade?: number | null;
  } | null;
  homeworkSubmissions: Array<{
    id: string;
    status: string;
    content?: string;
    fileUrl?: string;
  }>;
  projectSubmissions: Array<{
    id: string;
    status: string;
    grade?: number | null;
    feedback?: string | null;
    content?: string;
    fileUrl?: string;
  }>;
};

type PlanData = {
  id: string;
  title: string;
  description?: string;
  educationalStage: string;
  chatEnabled: boolean;
};

type ChatMessage = {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PlanLearnPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Sidebar / UI states
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Video playback session state
  const [activeVideoSource, setActiveVideoSource] = useState<VideoSource | null>(null);
  const [playerSession, setPlayerSession] = useState<{
    embedUrl: string;
    sessionToken: string;
    provider: string;
  } | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  // Homework & Project submission states
  const [homeworkText, setHomeworkText] = useState("");
  const [homeworkUrl, setHomeworkUrl] = useState("");
  const [submittingHw, setSubmittingHw] = useState(false);

  const [projectText, setProjectText] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [submittingProject, setSubmittingProject] = useState(false);

  // AI Assistant Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: "ai", text: "أهلاً بك! أنا مساعدك الدراسي الذكي. اسألني أي سؤال حول دروس هذه الخطة.", timestamp: new Date().toLocaleTimeString("ar-EG") }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Load Roadmap data ──
  const fetchRoadmap = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans/${planId}/roadmap`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push(`/plans/${planId}`);
          return;
        }
        throw new Error(data.error || "تعذر تحميل الخطة");
      }
      setPlan(data.plan);
      setLessons(data.lessons || []);

      // Preserve or set initial selected lesson
      if (data.lessons && data.lessons.length > 0) {
        setSelectedLessonId((prev) => {
          if (prev && data.lessons.some((l: Lesson) => l.id === prev)) return prev;
          // Default to the first unlocked lesson that is not fully completed
          const firstIncomplete = data.lessons.find((l: Lesson) => l.unlocked && (!l.progress || !l.progress.watched));
          return firstIncomplete ? firstIncomplete.id : data.lessons[0].id;
        });
      }
    } catch (err: any) {
      toastError(err.message || "حدث خطأ أثناء تحميل مسار الخطة");
    } finally {
      setLoading(false);
    }
  }, [planId, router, toastError]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setUser(d.user ? { name: d.user.name, role: d.user.role } : null))
      .catch(() => setUser(null));

    void fetchRoadmap();
  }, [planId, fetchRoadmap]);

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  // ── Auto-select/load Video Source ──
  useEffect(() => {
    if (!selectedLesson) {
      setActiveVideoSource(null);
      setPlayerSession(null);
      return;
    }

    const progress = selectedLesson.progress;
    const sources = selectedLesson.sources || [];

    // Find chosen or default source
    let source = sources.find(s => s.id === progress?.chosenSourceId);
    if (!source) source = sources.find(s => s.isDefault);
    if (!source && sources.length > 0) source = sources[0];

    setActiveVideoSource(source || null);
    setPlayerSession(null); // Reset player session to force loading the new source when chosen
  }, [selectedLessonId, lessons, selectedLesson]);

  // ── Initiate Video session ──
  const startVideoSession = async (source: VideoSource) => {
    if (!source.video) return;
    setLoadingPlayer(true);
    try {
      const res = await fetch(`/api/videos/${source.video.id}/watch`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setPlayerSession({
          embedUrl: data.embedUrl,
          sessionToken: data.sessionToken,
          provider: data.provider || "vdocipher"
        });
      } else {
        if (data.code === "VPN_DETECTED" || data.vpnDetected) {
          router.push(`/vpn-check?redirect_url=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        toastError(data.error || "فشل بدء تشغيل الفيديو");
      }
    } catch {
      toastError("تعذر بدء تشغيل الفيديو");
    } finally {
      setLoadingPlayer(false);
    }
  };

  // ── Choose Video Source ──
  const chooseSource = async (sourceId: string) => {
    if (!selectedLessonId) return;
    try {
      const res = await fetch(`/api/plans/${planId}/lessons/${selectedLessonId}/choose-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
        credentials: "include"
      });
      if (res.ok) {
        toastSuccess("تم حفظ اختيارك للمصدر بنجاح");
        void fetchRoadmap();
      } else {
        const d = await res.json();
        toastError(d.error || "فشل اختيار المصدر");
      }
    } catch {
      toastError("حدث خطأ أثناء حفظ المصدر");
    }
  };

  // ── Complete Video Watch ──
  const handleVideoEnded = async () => {
    if (!selectedLessonId || !activeVideoSource?.video) return;
    try {
      const res = await fetch(`/api/videos/${activeVideoSource.video.id}/complete`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toastSuccess("تم تسجيل إكمال الفيديو بنجاح! 🎉");
        void fetchRoadmap();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Submit Homework ──
  const handleHomeworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId) return;
    if (!homeworkText.trim() && !homeworkUrl.trim()) {
      toastError("الرجاء ملء محتوى الإجابة أو رابط الملف");
      return;
    }
    setSubmittingHw(true);
    try {
      const activeHw = selectedLesson?.homeworks?.[0];
      const res = await fetch(`/api/plans/${planId}/lessons/${selectedLessonId}/homework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planHomeworkId: activeHw?.id,
          content: homeworkText,
          fileUrl: homeworkUrl
        }),
        credentials: "include"
      });
      if (res.ok) {
        toastSuccess("تم تسليم الواجب بنجاح");
        setHomeworkText("");
        setHomeworkUrl("");
        void fetchRoadmap();
      } else {
        const d = await res.json();
        toastError(d.error || "فشل تسليم الواجب");
      }
    } catch {
      toastError("حدث خطأ أثناء تسليم الواجب");
    } finally {
      setSubmittingHw(false);
    }
  };

  // ── Submit Project ──
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId) return;
    if (!projectText.trim() && !projectUrl.trim()) {
      toastError("الرجاء ملء محتوى المشروع أو رابط الملف");
      return;
    }
    setSubmittingProject(true);
    try {
      const res = await fetch(`/api/plans/${planId}/lessons/${selectedLessonId}/submit-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: projectText,
          fileUrl: projectUrl
        }),
        credentials: "include"
      });
      if (res.ok) {
        toastSuccess("تم تسليم المشروع بنجاح! سيتم تقييمه تلقائياً بواسطة الذكاء الاصطناعي.");
        setProjectText("");
        setProjectUrl("");
        void fetchRoadmap();
      } else {
        const d = await res.json();
        toastError(d.error || "فشل تسليم المشروع");
      }
    } catch {
      toastError("حدث خطأ أثناء تسليم المشروع");
    } finally {
      setSubmittingProject(false);
    }
  };

  // ── Send Chat Message ──
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendingChat) return;

    const userMsg: ChatMessage = {
      sender: "user",
      text: inputMessage,
      timestamp: new Date().toLocaleTimeString("ar-EG")
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setSendingChat(true);

    // Scroll to bottom
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`/api/plans/${planId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          lessonId: selectedLessonId
        }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages((prev) => [...prev, {
          sender: "ai",
          text: data.reply || "عذراً، لم أستطع فهم سؤالك.",
          timestamp: new Date().toLocaleTimeString("ar-EG")
        }]);
      } else {
        toastError(data.error || "فشل إرسال الرسالة");
      }
    } catch {
      toastError("تعذر الاتصال بالمساعد الذكي");
    } finally {
      setSendingChat(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar user={user} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">جاري تحميل مسار الخطة الدراسية...</p>
          </div>
        </main>
      </div>
    );
  }

  // Calculate overall progress stats
  const completedLessonsCount = lessons.filter(
    (l) =>
      l.progress?.watched &&
      (!l.requiresQuiz || l.progress.quizPassed) &&
      (!l.requiresHomework || l.progress.homeworkPassed) &&
      (!l.hasProject || l.progress.projectPassed)
  ).length;

  const totalLessonsCount = lessons.length || 1;
  const progressPercentage = Math.round((completedLessonsCount / totalLessonsCount) * 100);

  // Find current active / next lesson
  const currentActiveLesson =
    lessons.find((l) => l.unlocked && (!l.progress || !l.progress.watched || !l.progress.quizPassed)) ||
    lessons[0];

  // Helper to parse description safely
  const formattedDescription = (() => {
    if (!plan?.description) return "مسار تدريبي ممتع يربط المفاهيم النظرية بالتطبيقات العملية خطوة بخطوة.";
    try {
      if (plan.description.startsWith("[") && plan.description.endsWith("]")) {
        const parsed = JSON.parse(plan.description);
        return Array.isArray(parsed) ? parsed.join(" • ") : plan.description;
      }
    } catch {}
    return plan.description;
  })();

  // Stage narrative titles based on index
  const STAGE_TITLES = [
    "🚀 انطلاق الأساسيات",
    "🛰️ البناء والتطبيق",
    "🌙 التعمق والتحدي",
    "⚡ التمارين المكثفة",
    "🤖 تقييم الذكاء البرمجي",
    "🏆 مشروع التخرج النهائي",
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#060B17] text-slate-100 font-sans selection:bg-[#4F7DFF] selection:text-white" dir="rtl">
      <Navbar user={user} />

      {/* Global CSS for scrollbars, button press dynamics & path offsets */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .duo-container {
          --x-offset: 36px;
        }
        @media (min-width: 640px) {
          .duo-container {
            --x-offset: 85px;
          }
        }
        @media (min-width: 1024px) {
          .duo-container {
            --x-offset: 160px;
          }
        }
      `}</style>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center space-y-6">
        
        {/* ── 1. TACTILE HERO & ACHIEVEMENT DASHBOARD ── */}
        <div className="w-full relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#172338] to-[#101827] p-6 md:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition-all duration-300">
          
          {/* Subtle Ambient Glow Blobs */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#4F7DFF]/15 blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#3DDC97]/15 blur-[90px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Main Plan Information (Left 7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Achievement Row (Streak, XP, Badges, Level) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-2xl bg-[#F7C948]/10 text-[#F7C948] text-xs font-bold border border-[#F7C948]/20 flex items-center gap-1.5 shadow-sm">
                  🔥 5 أيام مواظبة (Streak)
                </span>
                <span className="px-3.5 py-1.5 rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] text-xs font-bold border border-[#3DDC97]/20 flex items-center gap-1.5 shadow-sm">
                  ⭐ {(completedLessonsCount * 120 + 50).toLocaleString("ar-EG")} XP
                </span>
                <span className="px-3.5 py-1.5 rounded-2xl bg-[#7C5CFF]/10 text-[#7C5CFF] text-xs font-bold border border-[#7C5CFF]/20 flex items-center gap-1.5 shadow-sm">
                  🎖️ المستوى 3 مطور
                </span>
                <span className="px-3.5 py-1.5 rounded-2xl bg-[#4F7DFF]/10 text-[#4F7DFF] text-xs font-bold border border-[#4F7DFF]/20 flex items-center gap-1.5 shadow-sm">
                  ⚡ 94% دقة
                </span>
              </div>

              <div>
                <span className="text-xs font-extrabold text-[#4F7DFF] uppercase tracking-wider block mb-1">
                  الخطة الدراسية الحالية
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                  {plan?.title || "Plan A"}
                </h1>
                <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed max-w-2xl font-normal">
                  {formattedDescription}
                </p>
              </div>

              {/* Giant Tactile 3D "Continue Learning" Button (Height: 56px) */}
              {currentActiveLesson && (
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <button
                    onClick={() => {
                      if (currentActiveLesson.unlocked) {
                        setSelectedLessonId(currentActiveLesson.id);
                        setIsModalOpen(true);
                      }
                    }}
                    className="h-14 px-8 bg-[#4F7DFF] hover:bg-[#4370f0] text-white font-black text-base rounded-2xl border-b-4 border-[#2d56d9] active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-[0_8px_25px_rgba(79,125,255,0.35)] flex items-center justify-center gap-3 shrink-0"
                  >
                    <span>▶ واصل التعلم الآن</span>
                    <span className="text-sm">←</span>
                  </button>

                  <div className="px-4 py-3 rounded-2xl bg-[#18243D] border border-white/10 text-xs flex items-center gap-2.5 shadow-inner">
                    <span className="text-slate-400 font-medium">الهدف الحالي:</span>
                    <span className="font-bold text-[#4F7DFF] truncate max-w-[190px]">{currentActiveLesson.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">⏱️ 12 د</span>
                  </div>
                </div>
              )}
            </div>

            {/* Premium Circular Progress Ring Card (Right 5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-[24px] bg-[#121B2E] border border-white/10 backdrop-blur-md space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold block mb-1">إنجازك في المسار</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-[#3DDC97] font-mono tracking-tight">{progressPercentage}%</span>
                    <span className="text-xs text-slate-400">مكتمل</span>
                  </div>
                </div>
                {/* Tactile Progress Ring SVG */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#3DDC97"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={(2 * Math.PI * 26) * (1 - progressPercentage / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute text-xl">🚀</span>
                </div>
              </div>

              {/* Progress Bar with Glowing Fill */}
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-[#060B17] rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#4F7DFF] via-[#7C5CFF] to-[#3DDC97] rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(61,220,151,0.5)]"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                  <span>{completedLessonsCount} من أصل {totalLessonsCount} دروس مكتملة</span>
                  <span>المتبقي: {totalLessonsCount - completedLessonsCount} دروس</span>
                </div>
              </div>

              {/* Reward Highlights */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-400">🎁</span>
                  <span className="font-bold">مكافأة إكمال الخطة:</span>
                </span>
                <span className="font-black text-[#F7C948]">+500 XP + وسام خبير</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. TODAY'S GOAL ACTION CARD (🎯 هدف اليوم) ── */}
        <div className="w-full p-6 rounded-[24px] border border-white/10 bg-gradient-to-r from-[#121B2E] via-[#18243D] to-[#121B2E] backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#4F7DFF]/15 border border-[#4F7DFF]/30 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-white">هدف اليوم الدراسي</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F7C948]/15 text-[#F7C948] border border-[#F7C948]/30">+150 XP</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                أنقذ Streak اليوم بإنجاز درس (<strong className="text-white">{currentActiveLesson?.title || "الأساسيات"}</strong>) واجتياز الاختبار المباشر.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (currentActiveLesson?.unlocked) {
                setSelectedLessonId(currentActiveLesson.id);
                setIsModalOpen(true);
              }
            }}
            className="h-12 px-6 bg-[#3DDC97] hover:bg-[#32c988] text-slate-950 font-black text-sm rounded-2xl border-b-4 border-[#25a36c] active:border-b-0 active:translate-y-1 transition-all cursor-pointer shrink-0 self-start md:self-auto shadow-md"
          >
            🚀 ابدأ هدف اليوم
          </button>
        </div>

        {/* ── 3. ROADMAP TIMELINE (Oversized 100px Circular Nodes) ── */}
        <div className="w-full relative duo-container">
          
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <span>🗺️</span>
                <span>خريطة التعلم التفاعلية</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">طريق المعرفة - اضغط على الدائرة النشطة لفتح المرحلة</p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#3DDC97]" /> مكتمل</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#4F7DFF] animate-pulse" /> حالي</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-700" /> مقفل</span>
            </div>
          </div>

          <div className="relative w-full bg-[#121B2E] rounded-[28px] border border-white/10 p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col items-center min-h-[620px] backdrop-blur-xl">
            
            {/* Glowing Central Connector Line */}
            <div className="absolute top-12 bottom-12 w-2.5 bg-gradient-to-b from-[#3DDC97] via-[#4F7DFF] to-slate-800 rounded-full left-1/2 -translate-x-1/2 shadow-[0_0_15px_rgba(79,125,255,0.4)]" />

            {/* Winding Nodes List */}
            <div className="relative z-10 w-full flex flex-col items-center gap-16 py-6 max-h-[82vh] overflow-y-auto no-scrollbar pr-1 pl-1">
              {lessons.map((lesson, index) => {
                const active = selectedLessonId === lesson.id;
                const isCompleted =
                  lesson.progress?.watched &&
                  (!lesson.requiresQuiz || lesson.progress.quizPassed) &&
                  (!lesson.requiresHomework || lesson.progress.homeworkPassed) &&
                  (!lesson.hasProject || lesson.progress.projectPassed);

                const multipliers = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];
                const multiplier = multipliers[index % multipliers.length];

                // Story Title & Landmark
                const stageNarrative = STAGE_TITLES[index % STAGE_TITLES.length];
                const LANDMARKS = ["🧠", "🚀", "🏆", "☕", "🤖", "⚡", "📚", "👾"];
                const landmark = LANDMARKS[index % LANDMARKS.length];

                let btnStyle = "";
                let shadowStyle = "";
                let nodeIcon = null;
                let badgeStyle = "";

                if (lesson.hasProject) {
                  badgeStyle = "text-[#7C5CFF] border-[#7C5CFF]/30 bg-[#7C5CFF]/15";
                  if (isCompleted) {
                    btnStyle = "bg-[#3DDC97] text-slate-950 border-b-4 border-[#25a36c]";
                    nodeIcon = <span className="text-3xl">🎁</span>;
                  } else if (active) {
                    btnStyle = "bg-[#7C5CFF] text-white border-b-4 border-[#5b36e0] ring-4 ring-[#7C5CFF]/50 animate-pulse scale-105";
                    shadowStyle = "shadow-[0_0_40px_rgba(124,92,255,0.7)]";
                    nodeIcon = <span className="text-3xl">🤖</span>;
                  } else if (lesson.unlocked) {
                    btnStyle = "bg-[#7C5CFF] text-white border-b-4 border-[#5b36e0]";
                    nodeIcon = <span className="text-3xl">🤖</span>;
                  } else {
                    btnStyle = "bg-[#18243D] text-slate-600 border-b-4 border-[#0f172a] opacity-50 cursor-not-allowed";
                    nodeIcon = <span className="text-2xl">🔒</span>;
                  }
                } else if (lesson.requiresQuiz) {
                  badgeStyle = "text-[#F7C948] border-[#F7C948]/30 bg-[#F7C948]/15";
                  if (isCompleted) {
                    btnStyle = "bg-[#3DDC97] text-slate-950 border-b-4 border-[#25a36c]";
                    nodeIcon = <span className="text-3xl">🏆</span>;
                  } else if (active) {
                    btnStyle = "bg-[#F7C948] text-slate-950 border-b-4 border-[#cfa32b] ring-4 ring-[#F7C948]/50 animate-pulse scale-105";
                    shadowStyle = "shadow-[0_0_40px_rgba(247,201,72,0.7)]";
                    nodeIcon = <span className="text-3xl">🏆</span>;
                  } else if (lesson.unlocked) {
                    btnStyle = "bg-[#F7C948] text-slate-950 border-b-4 border-[#cfa32b]";
                    nodeIcon = <span className="text-3xl">🏆</span>;
                  } else {
                    btnStyle = "bg-[#18243D] text-slate-600 border-b-4 border-[#0f172a] opacity-50 cursor-not-allowed";
                    nodeIcon = <span className="text-2xl">🔒</span>;
                  }
                } else {
                  badgeStyle = "text-[#4F7DFF] border-[#4F7DFF]/30 bg-[#4F7DFF]/15";
                  if (isCompleted) {
                    btnStyle = "bg-[#3DDC97] text-slate-950 border-b-4 border-[#25a36c]";
                    nodeIcon = (
                      <svg className="w-10 h-10 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    );
                  } else if (active) {
                    btnStyle = "bg-[#4F7DFF] text-white border-b-4 border-[#2d56d9] ring-4 ring-[#4F7DFF]/50 animate-pulse scale-105";
                    shadowStyle = "shadow-[0_0_40px_rgba(79,125,255,0.7)]";
                    nodeIcon = <span className="text-3xl font-black">{index + 1}</span>;
                  } else if (lesson.unlocked) {
                    btnStyle = "bg-[#4F7DFF] text-white border-b-4 border-[#2d56d9]";
                    nodeIcon = <span className="text-3xl font-black">{index + 1}</span>;
                  } else {
                    btnStyle = "bg-[#18243D] text-slate-600 border-b-4 border-[#0f172a] opacity-50 cursor-not-allowed";
                    nodeIcon = <span className="text-2xl">🔒</span>;
                  }
                }

                return (
                  <div key={lesson.id} className="relative flex flex-col items-center w-full">
                    
                    {/* Floating Landmark Icon Along Curved Path */}
                    {multiplier !== 0 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-3xl sm:text-4xl select-none pointer-events-none opacity-40 animate-pulse transition-all duration-300"
                        style={{
                          transform: `translateX(calc(${-multiplier} * var(--x-offset))) translateY(-50%)`,
                        }}
                      >
                        {landmark}
                      </div>
                    )}

                    {/* Node Wrapper */}
                    <div
                      className="relative flex flex-col items-center group"
                      style={{ transform: `translateX(calc(${multiplier} * var(--x-offset)))` }}
                    >
                      {/* Active Node Floating Mascot Banner */}
                      {active && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
                          <div className="bg-[#4F7DFF] text-white text-[11px] font-black px-3.5 py-1.5 rounded-2xl whitespace-nowrap shadow-lg border border-white/20 flex items-center gap-1.5">
                            <span>أنت هنا الآن</span>
                            <span>🚀</span>
                          </div>
                          <div className="w-2.5 h-2.5 bg-[#4F7DFF] rotate-45 -mt-1 shadow-md" />
                        </div>
                      )}

                      {/* Giant Tactile 3D Circular Node Button (100px / w-24 h-24 sm:w-28 sm:h-28) */}
                      <button
                        onClick={() => {
                          if (lesson.unlocked) {
                            setSelectedLessonId(lesson.id);
                            setIsModalOpen(true);
                          }
                        }}
                        disabled={!lesson.unlocked}
                        className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center font-black text-2xl transition-all cursor-pointer outline-none active:translate-y-1 ${btnStyle} ${shadowStyle} group-hover:scale-105`}
                      >
                        {nodeIcon}
                      </button>

                      {/* Stage Card Details */}
                      <div
                        className={`mt-4 px-5 py-3 rounded-2xl text-center border max-w-[200px] backdrop-blur-md transition-all shadow-lg ${
                          active
                            ? "bg-[#18243D] border-[#4F7DFF]/40 text-white font-bold"
                            : isCompleted
                            ? "bg-[#18243D]/90 border-[#3DDC97]/30 text-[#3DDC97] font-semibold"
                            : lesson.unlocked
                            ? "bg-[#18243D]/80 border-white/10 text-slate-200 font-semibold"
                            : "bg-[#060B17]/80 border-white/5 text-slate-600 text-xs"
                        }`}
                      >
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border mb-1 inline-block ${badgeStyle}`}>
                          {stageNarrative}
                        </span>
                        <p className="text-xs font-bold truncate leading-tight mt-0.5">{lesson.title}</p>
                        
                        {/* Prominent Action Button for Active Node */}
                        {active && (
                          <button
                            onClick={() => {
                              setSelectedLessonId(lesson.id);
                              setIsModalOpen(true);
                            }}
                            className="mt-2.5 w-full h-8 px-3 rounded-xl bg-[#3DDC97] hover:bg-[#32c988] text-slate-950 font-black text-xs border-b-2 border-[#25a36c] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer"
                          >
                            ▶ ابدأ الآن
                          </button>
                        )}
                        {!lesson.unlocked && (
                          <p className="text-[9px] text-slate-500 mt-1 font-medium">تفتح بعد إنجاز ما قبلها</p>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>

      {/* Modern Lesson Gateways Modal Overlay */}
      {isModalOpen && selectedLesson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto no-scrollbar relative p-6 space-y-6">
            
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors border-none cursor-pointer text-lg font-bold"
            >
              &times;
            </button>

            {/* Modal Header */}
            <div className="text-center pt-2">
              <span className="text-[10px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full uppercase">
                بوابة الدرس
              </span>
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{selectedLesson.title}</h2>
            </div>

            {/* Gateways Cards list */}
            <div className="space-y-5">
              {/* 1. LECTURE / WATCH GATEWAY */}
              <div className="border border-sky-100 dark:border-sky-950/30 rounded-2xl p-5 bg-sky-50/30 dark:bg-sky-950/10 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎬</span>
                  <div>
                    <h4 className="text-sm font-black text-sky-950 dark:text-sky-400">محاضرة الشرح والمشاهدة</h4>
                    <p className="text-xs text-sky-700/70 dark:text-sky-500/70">شرح المادة العلمية التفاعلي الخاص بالدرس.</p>
                  </div>
                </div>

                {activeVideoSource ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-sky-100 dark:border-sky-900/20">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{activeVideoSource.video?.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{activeVideoSource.video?.durationMinutes} دقيقة</p>
                    </div>

                    <Link
                      href={`/courses/${activeVideoSource.video?.folder?.courseId}/learn?videoId=${activeVideoSource.video?.id}`}
                      className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black rounded-xl text-center block transition-all shadow-md shadow-sky-500/20 hover:scale-[1.01]"
                    >
                      ▶ انتقل إلى قاعة المعلم للمشاهدة ←
                    </Link>
                    
                    {/* Multiple sources switcher */}
                    {selectedLesson.sources.length > 1 && (
                      <div className="pt-2 border-t border-sky-100 dark:border-sky-900/10">
                        <p className="text-[10px] font-bold text-slate-500 mb-1.5">تغيير معلم الشرح أو المصدر:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLesson.sources.map((s, idx) => (
                            <button
                              key={s.id}
                              onClick={() => { chooseSource(s.id); }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                activeVideoSource?.id === s.id
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {s.video?.title || `مصدر ${idx + 1}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">لا يوجد مصدر فيديو محدد للدرس.</p>
                )}
              </div>

              {/* 2. QUIZ PORTAL */}
              {selectedLesson.requiresQuiz && (
                <div className="border border-amber-100 dark:border-amber-950/30 rounded-2xl p-5 bg-amber-50/30 dark:bg-amber-950/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📝</span>
                    <div>
                      <h4 className="text-sm font-black text-amber-950 dark:text-amber-400">الاختبار التقويمي المطلوب</h4>
                      <p className="text-xs text-amber-700/70 dark:text-amber-500/70">قياس فهمك لمحتوى الدرس ونقاط القوة والضعف.</p>
                    </div>
                  </div>

                  {selectedLesson.progress?.quizPassed ? (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                      <span>✓</span>
                      تم اجتياز الاختبار بنجاح (الدرجة: {selectedLesson.progress.quizScore}%)
                    </div>
                  ) : selectedLesson.quizzes?.[0] ? (
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        router.push(`/quizzes/${selectedLesson.quizzes[0].id}`);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl text-xs border-none cursor-pointer transition-colors text-center shadow-md shadow-amber-500/10"
                    >
                      ✍️ ابدأ الاختبار التقويمي الآن
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400">لم يتم تعيين اختبار لهذا الدرس بعد.</p>
                  )}
                </div>
              )}

              {/* 3. HOMEWORK PORTAL */}
              {selectedLesson.requiresHomework && (
                <div className="border border-indigo-100 dark:border-indigo-950/30 rounded-2xl p-5 bg-indigo-50/30 dark:bg-indigo-950/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📚</span>
                    <div>
                      <h4 className="text-sm font-black text-indigo-950 dark:text-indigo-400">الواجب الدراسي والتطبيق</h4>
                      <p className="text-xs text-indigo-700/70 dark:text-indigo-500/70">حل الأسئلة والتمارين وتسليمها لمراجعتها يدوياً من المعلم.</p>
                    </div>
                  </div>

                  {/* Submissions list */}
                  {selectedLesson.homeworkSubmissions.length > 0 && (() => {
                    const sub = selectedLesson.homeworkSubmissions[0];
                    const labels: Record<string, string> = { pending: "🔍 قيد التدقيق والتقييم من المعلم", passed: "✅ تم قبول الواجب بنجاح", failed: "❌ لم يتم قبول الواجب" };
                    return (
                      <div className={`p-3 rounded-xl text-xs font-bold ${
                        sub.status === "passed"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                          : sub.status === "failed"
                          ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-300"
                          : "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-300"
                      }`}>
                        حالة التسليم: {labels[sub.status] || sub.status}
                      </div>
                    );
                  })()}

                  {/* Submission form */}
                  {(!selectedLesson.progress?.homeworkPassed) && (
                    <form onSubmit={handleHomeworkSubmit} className="space-y-3">
                      <textarea
                        value={homeworkText}
                        onChange={e => setHomeworkText(e.target.value)}
                        placeholder="اكتب إجابة الواجب أو الملاحظات هنا..."
                        className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs text-[var(--ink)] resize-none"
                        style={{ borderColor: "var(--border)" }}
                        rows={3}
                      />
                      <input
                        type="text"
                        value={homeworkUrl}
                        onChange={e => setHomeworkUrl(e.target.value)}
                        placeholder="رابط ملف الواجب (Google Drive / OneDrive إلخ) - اختياري"
                        className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 text-xs text-[var(--ink)]"
                        style={{ borderColor: "var(--border)" }}
                      />
                      <button
                        type="submit"
                        disabled={submittingHw}
                        className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold rounded-xl text-xs border-none cursor-pointer disabled:opacity-50 transition-colors shadow-md"
                      >
                        {submittingHw ? "جاري تسليم الملف..." : "📤 تسليم الواجب الدراسي"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 4. AI PROJECT PORTAL */}
              {selectedLesson.hasProject && (
                <div className="border border-purple-100 dark:border-purple-950/30 rounded-2xl p-5 bg-purple-50/30 dark:bg-purple-950/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h4 className="text-sm font-black text-purple-950 dark:text-purple-400">تقييم الكود الذكي (AI Project)</h4>
                      <p className="text-xs text-purple-700/70 dark:text-purple-500/70">سلم مشروعك للحصول على تقييم وتصحيح فوري وتفاعلي بالذكاء الاصطناعي.</p>
                    </div>
                  </div>

                  {/* Submissions list */}
                  {selectedLesson.projectSubmissions.length > 0 && (() => {
                    const sub = selectedLesson.projectSubmissions[0];
                    return (
                      <div className="space-y-3">
                        <div className={`p-3 rounded-xl text-xs font-bold ${
                          sub.status === "graded"
                            ? (sub.grade ?? 0) >= 50
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                              : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-300"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-300"
                        }`}>
                          حالة المشروع: {sub.status === "graded" ? `تم التقييم بنجاح بنسبة (${sub.grade}%)` : "⏳ جاري التقييم بواسطة معلم الذكاء الاصطناعي..."}
                        </div>
                        {sub.feedback && (
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl text-xs leading-relaxed border border-purple-100 dark:border-purple-950/20">
                            <p className="font-bold text-[var(--ink)] mb-1">📝 تقييم وملاحظات الذكاء الاصطناعي:</p>
                            <p className="text-[var(--ink-2)] whitespace-pre-wrap">{sub.feedback}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Submission form */}
                  {(!selectedLesson.progress?.projectPassed) && (
                    <form onSubmit={handleProjectSubmit} className="space-y-3">
                      <textarea
                        value={projectText}
                        onChange={e => setProjectText(e.target.value)}
                        placeholder="ضع الكود البرمجي أو حل المشروع هنا..."
                        className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 text-xs text-[var(--ink)] font-mono resize-y"
                        style={{ borderColor: "var(--border)" }}
                        rows={4}
                      />
                      <input
                        type="text"
                        value={projectUrl}
                        onChange={e => setProjectUrl(e.target.value)}
                        placeholder="رابط المشروع على GitHub أو Replit (اختياري)"
                        className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 text-xs text-[var(--ink)]"
                        style={{ borderColor: "var(--border)" }}
                      />
                      <button
                        type="submit"
                        disabled={submittingProject}
                        className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white font-bold rounded-xl text-xs border-none cursor-pointer disabled:opacity-50 transition-colors shadow-md"
                      >
                        {submittingProject ? "جاري تقييم المشروع..." : "🤖 تسليم للمراجعة الذكية"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI STUDY ASSISTANT PANEL */}
      {plan?.chatEnabled && chatOpen && (
        <div className="fixed inset-y-0 left-0 w-80 z-[60] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-slide-left">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-black text-sm text-[var(--ink)]">💬 مساعد الدراسة الذكي</h3>
            <button
              onClick={() => setChatOpen(false)}
              className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-xl font-bold leading-none"
            >
              &times;
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"}`}>
                <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                  msg.sender === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-100 dark:bg-slate-800 text-[var(--ink)] rounded-tl-none"
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
            {sendingChat && (
              <div className="flex items-center gap-1.5 text-gray-400 text-xs px-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="p-3 border-t flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="اسألني عن الدرس الحالي..."
              className="flex-1 px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-[var(--ink)] outline-none"
              style={{ borderColor: "var(--border)" }}
              required
            />
            <button
              type="submit"
              disabled={sendingChat || !inputMessage.trim()}
              className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border-none cursor-pointer disabled:opacity-50 font-bold text-xs"
            >
              إرسال
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
