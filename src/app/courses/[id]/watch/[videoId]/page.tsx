"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SecurePlayer } from "@/components/ui/SecurePlayer";
import { VideoGuard } from "@/components/ui/VideoGuard";
import { AILectureNotesModal } from "@/components/player/AILectureNotesModal";

type VideoProvider = "vdocipher" | "bunny" | "youtube" | "alasly";

interface WatchSessionData {
  sessionId: string;
  sessionToken: string;
  videoId: string;
  video: {
    id: string;
    title: string;
    vdoCipherId: string;
    videoProvider: VideoProvider;
    providerVideoId: string;
    courseId: string;
    courseTitle: string;
  };
  expiresAt: string;
  isExpired: boolean;
  remainingWatches: number;
  totalWatches: number;
  usedWatches: number;
  teacherSlug?: string;
  studentPlan?: string;
}

function formatCountdown(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function WatchCountBar({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-500 shadow-inner ${
              i < used ? "bg-red-500 shadow-red-500/50" : "bg-slate-700/50 border border-white/5"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 font-mono font-bold tracking-wider">{used}/{total}</span>
    </div>
  );
}

export default function VideoWatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useParams() as Record<string, string>;
  const courseId = params.id;
  const videoId = params.videoId;

  // Token may be passed in URL on refresh so we don't create a duplicate session
  const tokenFromUrl = searchParams.get("token");

  const [session, setSession] = useState<WatchSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");
  const [iframeSrc, setIframeSrc] = useState("");
  const [wmLabel, setWmLabel] = useState("");
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // ── Smart Progress Sync Manager (Pillar 1: 30s Debounced Heartbeat + Event-based Flush) ──
  const lastSyncedSecondsRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const currentPlaybackSecondsRef = useRef<number>(0);

  const flushProgress = useCallback(
    (forcedSeconds?: number) => {
      if (!videoId) return;
      const sec = forcedSeconds !== undefined ? forcedSeconds : currentPlaybackSecondsRef.current;
      if (sec <= 0 && lastSyncedSecondsRef.current <= 0) return;

      const rounded = Math.round(sec);
      // Avoid redundant writes if position hasn't changed meaningfully
      if (Math.abs(rounded - lastSyncedSecondsRef.current) < 2) return;

      lastSyncedSecondsRef.current = rounded;
      lastSyncTimeRef.current = Date.now();

      fetch(`/api/videos/${videoId}/position`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: rounded }),
        keepalive: true,
      }).catch(() => {});
    },
    [videoId]
  );

  // Throttled progress handler during normal continuous playback (sync every 30s)
  const saveProgress = useCallback(
    (seconds: number) => {
      if (!videoId || seconds < 0) return;
      currentPlaybackSecondsRef.current = seconds;

      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
      const distanceSinceLastSync = Math.abs(seconds - lastSyncedSecondsRef.current);

      if (distanceSinceLastSync >= 30 || timeSinceLastSync >= 30000) {
        flushProgress(seconds);
      }
    },
    [videoId, flushProgress]
  );

  // Flush playback progress on page unload or tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushProgress();
      }
    };

    const handleBeforeUnload = () => {
      flushProgress();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushProgress();
    };
  }, [flushProgress]);

  // ── Unified Video Session Loader (Pillar 2: Single-Roundtrip Startup) ──
  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Single atomic request: mints token, gets embed URL, watermark, and saved resume position in 1 trip
      const endpoint = tokenFromUrl
        ? `/api/videos/${videoId}/watch?token=${encodeURIComponent(tokenFromUrl)}`
        : `/api/videos/${videoId}/watch`;

      const res = await fetch(endpoint, {
        method: tokenFromUrl ? "GET" : "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "تعذر تحميل جلسة المشاهدة");
        setLoading(false);
        return;
      }

      const expiresAt = new Date(data.expiresAt);

      setSession({
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        videoId,
        video: {
          id: videoId,
          title: data.video?.title || "محاضرة",
          vdoCipherId: "",
          videoProvider: (data.provider || data.video?.videoProvider || "vdocipher") as VideoProvider,
          providerVideoId: "",
          courseId,
          courseTitle: data.video?.courseTitle || "",
        },
        expiresAt: expiresAt.toISOString(),
        isExpired: data.isExpired ?? false,
        remainingWatches: data.remainingWatches,
        totalWatches: data.totalWatches,
        usedWatches: data.usedWatches,
        teacherSlug: data.teacherSlug,
        studentPlan: data.studentPlan,
      });

      if (data.watermark) {
        setWmLabel(data.watermark);
      }

      const savedSec = data.resumeSeconds ?? 0;
      setResumeSeconds(savedSec);
      lastSyncedSecondsRef.current = savedSec;
      currentPlaybackSecondsRef.current = savedSec;
      setResumeLoaded(true);

      setIframeSrc(data.embedUrl || "");
      setCountdown(formatCountdown(expiresAt.toISOString()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل جلسة المشاهدة");
    } finally {
      setLoading(false);
    }
  }, [courseId, videoId, tokenFromUrl]);

  useEffect(() => {
    if (!courseId || !videoId) return;
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [courseId, videoId, loadSession]);

  // Live countdown
  useEffect(() => {
    if (!session) return;
    const tick = () => setCountdown(formatCountdown(session.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Client-side deterrents: block DevTools keyboard shortcuts and right-click.
  // These are UX-level barriers (not cryptographic), but they stop casual extraction.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") { e.preventDefault(); return; }
      // Ctrl/Cmd + Shift + I / J / C (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
        e.preventDefault(); return;
      }
      // Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === "U") {
        e.preventDefault(); return;
      }
      // Ctrl+S (save page)
      if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === "S") {
        e.preventDefault(); return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleReturn = () => {
    router.push(`/courses/${courseId}/learn`);
  };

  const buildReturnUrl = () => {
    if (session) {
      return `/courses/${courseId}/learn`;
    }
    return `/courses/${courseId}/learn`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="text-center space-y-5">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <div>
            <p className="text-white font-semibold text-lg">جارٍ تجهيز جلسة المشاهدة...</p>
            <p className="text-white/40 text-sm mt-1">
              {tokenFromUrl ? "جارٍ التحقق من جلستك" : "جارٍ بدء جلستك الجديدة"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-3xl">
            {error?.includes("استنفدت") ? "🚫" : "⚠️"}
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-2">
              {error?.includes("استنفدت") ? "استنفذت المحاولات" : "لا يمكن تشغيل الفيديو"}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {error || "حدث خطأ غير متوقع"}
            </p>
          </div>
          <div className="space-y-2">
            <Link
              href={buildReturnUrl()}
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-center"
            >
              العودة لصفحة التعلم
            </Link>
            {!error?.includes("استنفدت") && (
              <button
                onClick={loadSession}
                className="w-full py-2.5 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white rounded-xl transition-colors text-sm"
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isSessionExpired = countdown === "00:00:00";

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col font-sans selection:bg-sky-500/30">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Left: breadcrumb */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-sky-400/80 font-semibold mb-1">{session.video.courseTitle}</p>
            <h1 className="text-lg font-black text-white truncate leading-tight tracking-wide">{session.video.title}</h1>
          </div>

          {/* Center: countdown + session status */}
          <div className="flex items-center gap-6 bg-black/40 border border-white/10 rounded-2xl px-6 py-3 shadow-inner">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">المتبقي</p>
              <p className={`text-2xl font-mono font-black tabular-nums tracking-wider ${isSessionExpired ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"}`}>
                {countdown}
              </p>
            </div>
            {!isSessionExpired && (
              <>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">مدة الجلسة</p>
                  <p className="text-sm font-mono text-slate-300 font-bold">4 ساعات</p>
                </div>
              </>
            )}
          </div>

          {/* Right: watch bar + return */}
          <div className="flex items-center gap-6 shrink-0 flex-1 justify-end">
            <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/5 hidden sm:block">
              <WatchCountBar used={session.usedWatches} total={session.totalWatches} />
            </div>
            <button
              onClick={handleReturn}
              className="group flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-sky-400 group-hover:-translate-x-1 transition-transform" style={{ transform: "scaleX(-1)" }}>
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              العودة
            </button>
          </div>
        </div>
      </header>

      {/* Player area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 pt-32 relative z-10">
        <div className="w-full max-w-[1100px] space-y-6">

          {/* Protection notice */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <span className="text-red-400 text-sm">🔒</span>
              </div>
              <span className="text-slate-300 font-medium tracking-wide">رابط الفيديو محمي — لا يمكن نسخه أو مشاركته</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-sky-400 font-medium bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>مشاهدة خاصة بك فقط</span>
            </div>
          </div>

          {/* Player card wrapper for glowing effect */}
          <div
            className="relative group"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Animated Glow Behind Player */}
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-500 rounded-[1.5rem] blur-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse" />
            
            <div
              className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a0f1e] shadow-2xl"
            >
              {/* Top gradient + overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent z-10 pointer-events-none" />

            {/* Live badge */}
            {!isSessionExpired && (
              <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white/80 font-medium">مشاهدة مباشرة</span>
                </div>
              </div>
            )}

            {/* Expired badge */}
            {isSessionExpired && (
              <div className="absolute top-4 right-4 z-20">
                <div className="flex items-center gap-1.5 bg-red-900/80 backdrop-blur-sm border border-red-700/50 rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-200 font-medium">انتهت الجلسة</span>
                </div>
              </div>
            )}

            {/* Resume indicator — YouTube auto-seeks to the saved position */}
            {session.video.videoProvider === "youtube" && resumeSeconds > 3 && (
              <div className="absolute top-16 right-4 z-20">
                <div className="flex items-center gap-1.5 bg-sky-900/80 backdrop-blur-sm border border-sky-600/40 rounded-full px-3 py-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-sky-300">
                    <path d="M12 8v4l3 2M12 3a9 9 0 109 9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-xs text-sky-100 font-medium">تابعنا من {formatMMSS(resumeSeconds)}</span>
                </div>
              </div>
            )}

            {/* Back button overlay */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={handleReturn}
                className="flex items-center gap-2 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 text-white text-sm hover:bg-black/90 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ transform: "scaleX(-1)" }}>
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                العودة للكورس
              </button>
            </div>

            {/* The player — provider-aware, watermark-safe in fullscreen, protected by VideoGuard */}
            {iframeSrc && resumeLoaded ? (
              <VideoGuard
                studentName={wmLabel}
                studentPhone={wmLabel}
                videoId={videoId}
                onExit={handleReturn}
              >
                <SecurePlayer
                  embedUrl={iframeSrc}
                  title={session.video.title}
                  watermark={wmLabel}
                  provider={session.video.videoProvider}
                  startSeconds={resumeSeconds}
                  onProgress={saveProgress}
                  onPause={() => flushProgress()}
                  onEnded={() => flushProgress()}
                />
              </VideoGuard>
            ) : (
              <div style={{ paddingTop: "56.25%" }} className="relative bg-slate-900">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">جارٍ تحميل الفيديو...</p>
                </div>
              </div>
            )}

            {/* Bottom bar */}
            <div className="bg-slate-950/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold tracking-wide">{session.video.title}</p>
                <p className="text-sky-400/80 text-xs mt-1 font-medium">
                  {session.video.courseTitle} • جلستك صالحة لمدة 4 ساعات
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-cyan-500/20 active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer border border-cyan-400/30"
                >
                  <span>🤖</span>
                  <span>ملخص المحاضرة الذكي</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-ai-assistant", {
                        detail: { initialPrompt: `اشرحلي درس ${session.video.title}` },
                      })
                    );
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-teal-500/20 active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer border border-teal-400/30"
                >
                  <span>💬</span>
                  <span>اسأل المساعد</span>
                </button>
                {session.teacherSlug && (
                  <Link
                    href={
                      session.studentPlan === "lesson"
                        ? `/homeworks/teacher/${session.teacherSlug}?type=all&course=all&search=${encodeURIComponent(session.video.title)}`
                        : `/homeworks/teacher/${session.teacherSlug}`
                    }
                    target="_blank"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg hover:shadow-sky-500/20 active:scale-95 flex items-center gap-1.5 shrink-0"
                  >
                    <span>📝</span>
                    <span>
                      {session.studentPlan === "lesson"
                        ? "واجب الدرس"
                        : session.studentPlan === "folder"
                        ? "واجبات المجلد"
                        : "واجبات الكورس"}
                    </span>
                  </Link>
                )}
                {/* Provider badge */}
                <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  session.video.videoProvider === "bunny"
                    ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                    : session.video.videoProvider === "youtube"
                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                    : session.video.videoProvider === "alasly"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-400"
                }`}>
                  <span>
                    {session.video.videoProvider === "bunny" ? "🐰" : session.video.videoProvider === "youtube" ? "▶️" : session.video.videoProvider === "alasly" ? "🛡️" : "🔐"}
                  </span>
                  <span>
                    {session.video.videoProvider === "bunny" ? "Bunny" : session.video.videoProvider === "youtube" ? "YouTube" : session.video.videoProvider === "alasly" ? "Alasly" : "VdoCipher"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Footer hints */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 px-2">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>تنتهي الجلسة تلقائياً بعد 4 ساعات</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>رابط الفيديو لا يمكن مشاركته</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>للمساعدة: تواصل مع المعلم</span>
            </div>
          </div>
        </div>
      </main>

      {/* AI Lecture Notes & Summary Modal — completely isolated from player DOM & security guards */}
      <AILectureNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        videoId={session.video.id}
        videoTitle={session.video.title}
        courseTitle={session.video.courseTitle}
      />
    </div>
  );
}