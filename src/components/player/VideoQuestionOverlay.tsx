"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Non-blocking overlay question for "overlay" mode.
 * Renders as a compact card over a corner of the player. Video keeps playing.
 * Student can answer at their own pace. No auto-dismiss — stays until answered
 * or the video ends.
 */

type VideoQuestion = {
  id: string;
  triggerSecond: number;
  mode: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export function VideoQuestionOverlay({
  question,
  videoId,
  watchSessionId,
  currentSecond,
  onAnswered,
  onDismiss,
}: {
  question: VideoQuestion;
  videoId: string;
  watchSessionId?: string;
  currentSecond: number;
  onAnswered: (result: { isCorrect: boolean; correctOption: string; explanation?: string }) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctOption: string;
    explanation?: string;
  } | null>(null);

  const options = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ];

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/questions/${question.id}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedOption: selected,
          answeredAtSecond: Math.round(currentSecond),
          watchSessionId,
        }),
      });
      const data = await res.json();
      const r = {
        isCorrect: data.isCorrect ?? false,
        correctOption: data.correctOption ?? "",
        explanation: data.explanation ?? undefined,
      };
      setResult(r);
      // Auto-close after 3s with the result
      setTimeout(() => {
        onAnswered(r);
      }, 3000);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 20, y: -10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute top-3 left-3 z-25 w-[280px] sm:w-[320px] max-w-[85%]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--surface)]/95 backdrop-blur-lg rounded-xl border border-[var(--border)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-sky-500/10 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span className="text-[11px] font-bold text-sky-500">سؤال سريع</span>
            </div>
          </div>

          {/* Question */}
          <div className="px-3.5 py-3">
            <p className="text-xs font-semibold text-[var(--ink)] leading-relaxed mb-3">
              {question.questionText}
            </p>

            {/* Options — compact */}
            <div className="space-y-1.5">
              {options.map((opt) => {
                let cls = "border-[var(--border)] hover:border-sky-400/40";
                if (result) {
                  if (opt.key === result.correctOption) cls = "border-emerald-500/50 bg-emerald-500/10";
                  else if (opt.key === selected && !result.isCorrect) cls = "border-red-500/50 bg-red-500/10";
                  else cls = "border-[var(--border)] opacity-40";
                } else if (selected === opt.key) {
                  cls = "border-sky-400/50 bg-sky-400/8";
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => !result && setSelected(opt.key)}
                    disabled={!!result}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-right transition-all ${cls}`}
                  >
                    <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black ${
                      result && opt.key === result.correctOption
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : selected === opt.key && !result
                        ? "border-sky-400 bg-sky-400 text-white"
                        : "border-[var(--border)] text-[var(--ink-muted)]"
                    }`}>
                      {result && opt.key === result.correctOption ? "✓" : opt.key}
                    </span>
                    <span className="text-[11px] text-[var(--ink)] flex-1 truncate">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Result message */}
            {result && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[11px] font-bold mt-2 ${result.isCorrect ? "text-emerald-500" : "text-red-500"}`}
              >
                {result.isCorrect ? "✓ صحيح!" : "✗ خطأ"}
                {result.explanation && (
                  <span className="font-normal text-[var(--ink-muted)]"> — {result.explanation}</span>
                )}
              </motion.p>
            )}

            {/* Submit / close */}
            {!result ? (
              <button
                onClick={submit}
                disabled={!selected || submitting}
                className="w-full mt-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
              >
                {submitting ? "..." : "تأكيد"}
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
