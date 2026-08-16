"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface AILectureNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  courseTitle?: string;
}

export function AILectureNotesModal({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  courseTitle,
}: AILectureNotesModalProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const fetchSummary = async (forceRefresh = false) => {
    if (!videoId) return;
    setLoading(true);
    setError("");
    try {
      const url = `/api/videos/${videoId}/ai-summary${forceRefresh ? "?refresh=true" : ""}`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
      } else {
        setError(data.error || "تعذر توليد ملخص المحاضرة");
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && videoId && !summary) {
      void fetchSummary(false);
    }
  }, [isOpen, videoId, summary]);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>ملخص محاضرة: ${videoTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111; line-height: 1.8; direction: rtl; }
            h1 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 10px; }
            h2, h3, h4 { color: #0f172a; margin-top: 24px; }
            ul, ol { padding-right: 20px; }
            li { margin-bottom: 8px; }
            .header-meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>ملخص المحاضرة الذكي — Code-UP</h1>
          <div class="header-meta">
            <strong>الدرس:</strong> ${videoTitle} | <strong>الكورس:</strong> ${courseTitle || "عام"} | <strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-EG")}
          </div>
          <div style="white-space: pre-wrap;">${summary}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: "rgba(2, 6, 23, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-xl shadow-lg shadow-teal-500/20">
                  🤖
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>ملخص المحاضرة الذكي</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      AI Notes
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                    {videoTitle} {courseTitle ? `• ${courseTitle}` : ""}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border-none"
                aria-label="إغلاق"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>📌 ملخص تعليمي مركز لمراجعة ليلة الامتحان</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={loading || !summary}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border border-slate-700/50 active:scale-95"
                >
                  <span>{copied ? "✓ تم النسخ" : "📋 نسخ الملخص"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={loading || !summary}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border border-slate-700/50 active:scale-95"
                >
                  <span>🖨️ طباعة / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchSummary(true)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border border-teal-500/30 active:scale-95"
                >
                  <span>🔄 إعادة التوليد</span>
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-slate-200 leading-relaxed font-sans select-text">
              {loading ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
                  <div>
                    <p className="text-white font-bold text-base">جارٍ تحليل المحاضرة وصياغة الملخص...</p>
                    <p className="text-slate-400 text-xs mt-1">
                      يقوم الذكاء الاصطناعي باستخراج المفاهيم الجوهرية، القوانين، وتكات الامتحانات ✨
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="py-12 text-center space-y-3">
                  <div className="text-3xl">⚠️</div>
                  <p className="text-rose-400 font-bold">{error}</p>
                  <button
                    onClick={() => fetchSummary(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none space-y-3 whitespace-pre-wrap leading-relaxed text-slate-200">
                  {summary}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>💡 مدعوم بمحركات الذكاء الاصطناعي التوليدي من Code-UP</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors cursor-pointer border-none"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
