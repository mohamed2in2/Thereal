"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CURRICULUM_CHAPTERS,
  CURRICULUM_QUESTIONS,
  type CurriculumChapter,
  type CurriculumQuestion,
} from "@/lib/curriculum-programming-questions";
import { updateIQ } from "@/lib/iq-system";

type AnswerState = { choice: string; correct: boolean } | null;

function shuffle<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre
      dir="ltr"
      className="mt-4 max-h-64 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950 p-4 text-left font-mono text-sm leading-7 text-sky-100 shadow-inner"
    >
      <code>{code}</code>
    </pre>
  );
}

export function CurriculumPractice() {
  const prefersReducedMotion = useReducedMotion();
  const [chapter, setChapter] = useState<CurriculumChapter | "all">("all");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [answer, setAnswer] = useState<AnswerState>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [serverCompleted, setServerCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionStartedAt] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);

  const questions = useMemo(
    () => chapter === "all"
      ? CURRICULUM_QUESTIONS
      : CURRICULUM_QUESTIONS.filter((item) => item.chapter === chapter),
    [chapter]
  );
  const question: CurriculumQuestion | undefined = questions[questionIndex];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/curriculum/practice", { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { completedCount?: number; correctCount?: number; completedQuestionIds?: string[] } | null) => {
        if (cancelled || !data) return;
        setCompleted(data.completedCount ?? 0);
        setScore(data.correctCount ?? 0);
        setServerCompleted(data.completedQuestionIds ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setQuestionIndex(0);
    setAnswer(null);
    setFinished(false);
  }, [chapter]);

  useEffect(() => {
    if (question) setChoices(shuffle(question.choices));
  }, [question]);

  const resetPractice = useCallback(() => {
    setQuestionIndex(0);
    setAnswer(null);
    setScore(0);
    setCompleted(0);
    setFinished(false);
  }, []);

  const openAiHelp = () => {
    if (!question) return;
    window.dispatchEvent(new CustomEvent("open-ai-assistant", {
      detail: {
        initialPrompt: `اشرح لي مفهوم «${question.lessonTitle}» من منهج البرمجة. السؤال الحالي: ${question.question} لا تعطِني الإجابة مباشرة؛ وجّهني خطوة بخطوة.`,
      },
    }));
  };

  const submitAnswer = async (choice: string) => {
    if (!question || answer || saving) return;
    const correct = choice === question.answer;
    setAnswer({ choice, correct });
    setScore((current) => current + (correct ? 1 : 0));
    setCompleted((current) => current + (serverCompleted.includes(question.id) ? 0 : 1));
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum/practice", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, choice }),
      });
      const data = await res.json().catch(() => null) as {
        progress?: { completedCount?: number; correctCount?: number; completedQuestionIds?: string[] };
      } | null;
      if (res.ok && data?.progress) {
        setCompleted(data.progress.completedCount ?? completed);
        setScore(data.progress.correctCount ?? score);
        setServerCompleted(data.progress.completedQuestionIds ?? serverCompleted);
      }
    } catch {
      // The answer stays visible; the next attempt re-syncs with the server.
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!question) return;
    if (questionIndex >= questions.length - 1) {
      updateIQ("coding", {
        correct: score,
        total: questions.length,
        totalTimeMs: Date.now() - sessionStartedAt,
        avgLevel: 5,
        maxStreak: 0,
        difficulty: "medium",
      });
      setFinished(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setAnswer(null);
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-800/70" />
        <div className="h-[28rem] animate-pulse rounded-3xl bg-slate-800/70" />
      </div>
    );
  }

  if (finished) {
    return (
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-sky-400/25 bg-slate-900/90 p-8 text-center shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
        dir="rtl"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-3xl text-emerald-300">✓</div>
        <h3 className="text-2xl font-black text-white">أحسنتِ! خلصتِ الجولة</h3>
        <p className="mt-2 text-slate-300">أجبتِ عن {questions.length} أسئلة، منها {score} صحيحة.</p>
        <p className="mt-1 text-sm text-sky-200">تم حفظ عدد الأسئلة المكتملة وتحديث نقاط الذكاء.</p>
        <button type="button" onClick={resetPractice} className="mt-6 min-h-11 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/30">جولة جديدة</button>
      </motion.section>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[240px_1fr]" dir="rtl" aria-label="أسئلة برمجة المنهج">
      <aside className="h-fit rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 lg:sticky lg:top-24">
        <p className="px-3 pb-2 text-xs font-bold text-slate-400">اختاري الفصل</p>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
          <button type="button" onClick={() => setChapter("all")} aria-pressed={chapter === "all"} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-400/30 lg:block lg:w-full lg:text-right ${chapter === "all" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>كل الفصول</button>
          {CURRICULUM_CHAPTERS.map((item) => (
            <button key={item.id} type="button" onClick={() => setChapter(item.id)} aria-pressed={chapter === item.id} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-400/30 lg:block lg:w-full lg:text-right ${chapter === item.id ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{item.shortLabel}</button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
          <div className="flex items-center justify-between text-slate-400"><span>المكتمل</span><strong className="text-white">{completed}</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, (completed / CURRICULUM_QUESTIONS.length) * 100)}%` }} /></div>
          <div className="mt-2 flex items-center justify-between text-slate-400"><span>الصحيح</span><strong className="text-emerald-300">{score}</strong></div>
        </div>
      </aside>

      {question ? (
        <motion.article
          key={question.id}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.18)] sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-sky-400/15 px-3 py-1.5 text-sky-200">الفصل {question.lessonNumber.split("-")[0]}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">{question.lessonTitle}</span>
            </div>
            <span className="text-sm font-bold text-slate-400">{questionIndex + 1} / {questions.length}</span>
          </div>

          <h3 className="mt-6 max-w-3xl text-xl font-black leading-9 text-white">{question.question}</h3>
          {question.code && <CodeBlock code={question.code} />}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {choices.map((choice, index) => {
              const selected = answer?.choice === choice;
              const correct = answer && choice === question.answer;
              return (
                <button
                  key={`${question.id}-${choice}`}
                  type="button"
                  onClick={() => void submitAnswer(choice)}
                  disabled={Boolean(answer) || saving}
                  className={`min-h-14 rounded-2xl border px-4 py-3 text-right text-sm font-bold leading-6 transition focus:outline-none focus:ring-4 focus:ring-sky-400/30 disabled:cursor-default ${correct ? "border-emerald-400 bg-emerald-400/15 text-emerald-100" : selected ? "border-rose-400 bg-rose-400/15 text-rose-100" : "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-sky-400/70 hover:bg-sky-400/10"}`}
                  aria-label={`اختيار ${index + 1}`}
                >
                  <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs text-slate-300">{String.fromCharCode(1571 + index)}</span>
                  {choice}
                </button>
              );
            })}
          </div>

          {answer && (
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-5 rounded-2xl border p-4 ${answer.correct ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
              <p className={`font-black ${answer.correct ? "text-emerald-200" : "text-amber-100"}`}>{answer.correct ? "إجابة صحيحة ✓" : "مش مشكلة—نراجعها سوا"}</p>
              {!answer.correct && <p className="mt-1 text-sm font-bold text-amber-100">{question.revisionPrompt}</p>}
              <p className="mt-2 text-sm leading-7 text-slate-200">{question.explanation}</p>
              <p className="mt-3 border-t border-white/10 pt-3 text-xs font-bold text-sky-200">المصدر: كتاب البرمجة والذكاء الاصطناعي — {question.chapterTitle} — الدرس {question.lessonNumber} — صـ {question.bookPage}</p>
            </motion.div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={openAiHelp} className="min-h-11 rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-2.5 text-sm font-bold text-sky-200 transition hover:bg-sky-400/20 focus:outline-none focus:ring-4 focus:ring-sky-400/30">اسألي المساعد عن المفهوم</button>
            {answer && <button type="button" onClick={next} className="min-h-11 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/30">{questionIndex === questions.length - 1 ? "عرض النتيجة" : "السؤال التالي"}</button>}
          </div>
        </motion.article>
      ) : (
        <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-10 text-center text-slate-300">لا توجد أسئلة لهذا الفصل حاليًا.</div>
      )}
    </section>
  );
}
