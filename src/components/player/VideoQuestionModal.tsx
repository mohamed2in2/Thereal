"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Full-screen blocking question modal for "pause" mode.
 * Renders over the player when a timed question fires. Blocks resume until answered.
 */

type VideoQuestion = {
  id: string;
  triggerSecond: number;
  mode: string;
  questionType?: string; // "mcq" | "essay"
  questionText: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
};

export function VideoQuestionModal({
  question,
  videoId,
  watchSessionId,
  currentSecond,
  onAnswered,
}: {
  question: VideoQuestion;
  videoId: string;
  watchSessionId?: string;
  currentSecond: number;
  onAnswered: (result: { isCorrect: boolean; correctOption: string; explanation?: string }) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [essayText, setEssayText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [essaySubmitted, setEssaySubmitted] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctOption: string;
    explanation?: string;
  } | null>(null);

  const isEssay = question.questionType === "essay";

  const options = [
    { key: "A", text: question.optionA ?? "" },
    { key: "B", text: question.optionB ?? "" },
    { key: "C", text: question.optionC ?? "" },
    { key: "D", text: question.optionD ?? "" },
  ];

  const submit = async () => {
    if (isEssay ? !essayText.trim() : !selected) return;
    if (submitting) return;
    setSubmitting(true);

    try {
      const body = isEssay
        ? { essayAnswer: essayText.trim(), answeredAtSecond: Math.round(currentSecond), watchSessionId }
        : { selectedOption: selected, answeredAtSecond: Math.round(currentSecond), watchSessionId };

      const res = await fetch(`/api/videos/${videoId}/questions/${question.id}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (isEssay) {
        setEssaySubmitted(true);
        setResult({ isCorrect: false, correctOption: "" });
      } else {
        const r = {
          isCorrect: data.isCorrect ?? false,
          correctOption: data.correctOption ?? "",
          explanation: data.explanation ?? undefined,
        };
        setResult(r);
      }
    } catch {
      // On error, allow retry
      setSubmitting(false);
    }
  };

  const dismiss = () => {
    onAnswered(result || { isCorrect: false, correctOption: "" });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] w-[90%] max-w-lg p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <h3 className="font-bold text-[var(--ink)] text-base">
                {isEssay ? "سؤال مقالي أثناء المشاهدة" : "سؤال اختيار من متعدد"}
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)]">
                أجب للمتابعة — {Math.floor(question.triggerSecond / 60)}:{String(question.triggerSecond % 60).padStart(2, "0")}
              </p>
            </div>
          </div>

          {/* Question text */}
          <p className="text-sm font-semibold text-[var(--ink)] leading-relaxed mb-5">
            {question.questionText}
          </p>

          {/* Essay or MCQ Options */}
          {isEssay ? (
            <div className="mb-6 space-y-2">
              <textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                disabled={essaySubmitted}
                placeholder="اكتب إجابتك هنا بوضوح..."
                rows={4}
                className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all resize-none"
              />
            </div>
          ) : (
            <div className="space-y-2.5 mb-6">
              {options.map((opt) => {
                let optClass = "border-[var(--border)] hover:border-sky-400/50 hover:bg-sky-400/5";
                if (result) {
                  if (opt.key === result.correctOption) {
                    optClass = "border-emerald-500/60 bg-emerald-500/10";
                  } else if (opt.key === selected && !result.isCorrect) {
                    optClass = "border-red-500/60 bg-red-500/10";
                  } else {
                    optClass = "border-[var(--border)] opacity-50";
                  }
                } else if (selected === opt.key) {
                  optClass = "border-sky-400/60 bg-sky-400/10 shadow-[0_0_0_3px_rgba(56,189,248,0.15)]";
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => !result && setSelected(opt.key)}
                    disabled={!!result}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-right transition-all ${optClass}`}
                  >
                    <span className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black transition-colors ${
                      result && opt.key === result.correctOption
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : result && opt.key === selected && !result.isCorrect
                        ? "border-red-500 bg-red-500 text-white"
                        : selected === opt.key
                        ? "border-sky-400 bg-sky-400 text-white"
                        : "border-[var(--border)] text-[var(--ink-muted)]"
                    }`}>
                      {result && opt.key === result.correctOption ? "✓" : opt.key}
                    </span>
                    <span className="text-sm text-[var(--ink)] flex-1">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Essay confirmation or MCQ explanation */}
          {essaySubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 mb-4 bg-sky-500/10 border border-sky-500/30"
            >
              <p className="text-sm font-bold text-sky-500">تم إرسال إجابتك المقالية بنجاح! 📝</p>
              <p className="text-xs text-[var(--ink-muted)] mt-1.5 leading-relaxed">
                سيقوم المعلم بمراجعة إجابتك وتقييمها وإرسال الملاحظات لك قريباً.
              </p>
            </motion.div>
          )}

          {!isEssay && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl p-4 mb-4 ${
                result.isCorrect
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className={`text-sm font-bold ${result.isCorrect ? "text-emerald-500" : "text-red-500"}`}>
                {result.isCorrect ? "إجابة صحيحة! 🎉" : "إجابة خاطئة"}
              </p>
              {result.explanation && (
                <p className="text-xs text-[var(--ink-muted)] mt-1.5 leading-relaxed">{result.explanation}</p>
              )}
            </motion.div>
          )}

          {/* Action button */}
          {!result && !essaySubmitted ? (
            <button
              onClick={submit}
              disabled={(isEssay ? !essayText.trim() : !selected) || submitting}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_-6px_rgba(37,99,235,0.7)]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جارٍ الإرسال...
                </span>
              ) : (
                "تأكيد الإجابة"
              )}
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shadow-[0_4px_14px_-6px_rgba(37,99,235,0.7)]"
            >
              متابعة المشاهدة ←
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
