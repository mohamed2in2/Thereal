"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useToast } from "@/components/ui/Toast";

type QuizQuestion = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  order: number;
};

type QuizPayload = {
  id: string;
  title: string;
  timeLimitMinutes: number;
  folderId: string;
  courseId: string;
  course: { title: string; subject: string };
  questions: QuizQuestion[];
};

type ResultBreakdown = {
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  yourAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
};

type QuizResult = {
  score: number;
  correct: number;
  totalQ: number;
  passed: boolean;
  breakdown: ResultBreakdown[];
  quizTitle: string;
  courseId: string;
};

const optionLabels = ["A", "B", "C", "D"] as const;

export default function QuizPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const params = useParams<{ id: string }>();
  const quizId = params.id;

  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState<{
    score: number; totalQ: number; completedAt: string;
    quizTitle: string; courseId: string;
  } | null>(null);

  const totalQuestions = quiz?.questions.length ?? 0;
  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ? { name: d.user.name, role: d.user.role } : null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const res = await fetch(`/api/quizzes/${quizId}`);
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error(data.error || "تعذر تحميل الاختبار");
        }

        if (data.alreadyCompleted) {
          setAlreadyCompleted({
            score: data.result.score,
            totalQ: data.result.totalQ,
            completedAt: data.result.completedAt,
            quizTitle: data.quiz.title,
            courseId: data.quiz.courseId,
          });
          return;
        }

        setQuiz(data.quiz);
        setRemainingSeconds((data.timeLimitMinutes || 30) * 60);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل الاختبار");
      } finally {
        setLoading(false);
      }
    };

    if (quizId) loadQuiz();
  }, [quizId, router]);

  const submitQuiz = useCallback(
    async (isAutoSubmit = false) => {
      if (!quiz || saving || submitted) return;
      setSaving(true);
      setError("");

      try {
        const res = await fetch(`/api/quizzes/${quiz.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, startedAt }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "فشل تسليم الاختبار");
        }

        setSubmitted(true);
        setResult({
          score: data.score,
          correct: data.correct,
          totalQ: data.totalQ,
          passed: data.passed,
          breakdown: data.breakdown ?? [],
          quizTitle: data.quizTitle || quiz.title,
          courseId: data.courseId || quiz.courseId,
        });

        toastSuccess(
          isAutoSubmit
            ? "انتهى الوقت وتم حفظ إجاباتك تلقائياً"
            : `تم تسليم الاختبار — درجتك ${data.score}%`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "فشل تسليم الاختبار";
        setError(message);
        toastError(message);
      } finally {
        setSaving(false);
      }
    },
    [answers, quiz, saving, startedAt, submitted, toastSuccess, toastError]
  );

  useEffect(() => {
    if (!quiz || submitted) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void submitQuiz(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [quiz, submitQuiz, submitted]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const optionText = (item: ResultBreakdown, label: string) => {
    const key = `option${label}` as keyof ResultBreakdown;
    return String(item[key] ?? "");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.24),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="rounded-3xl border border-white/60 bg-white/80 p-10 text-center text-slate-500 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-400">
            جارٍ تجهيز الاختبار...
          </div>
        ) : alreadyCompleted ? (
          <section className="rounded-[2rem] border border-white/50 bg-white/85 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 sm:p-8">
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">نتيجتك السابقة</p>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">{alreadyCompleted.quizTitle}</h1>

            <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50 p-6 text-center dark:border-sky-900/40 dark:bg-sky-950/30">
              <div className="text-5xl font-black text-sky-600 dark:text-sky-400">
                {Math.round(alreadyCompleted.score)}%
              </div>
              <p className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-200">
                {Math.round(alreadyCompleted.score) >= 50 ? "ناجح ✓" : "راسب ✕"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                الدرجة: {Math.round(alreadyCompleted.score)}% من {alreadyCompleted.totalQ} سؤال
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                تاريخ الحل: {new Date(alreadyCompleted.completedAt).toLocaleString("ar-EG")}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                🔒 لا يمكن إعادة الاختبار إلا بإذن من المعلم
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/courses/${alreadyCompleted.courseId}`)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
              >
                العودة للكورس
              </button>
              <button
                onClick={() => router.push("/library")}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                مكتبتي
              </button>
            </div>
          </section>
        ) : error && !result ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-xl dark:border-red-900/40 dark:bg-red-950/30">
            <p className="mb-4 text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => router.push("/courses")}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-white dark:bg-white dark:text-slate-900"
            >
              العودة للكورسات
            </button>
          </div>
        ) : result ? (
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/50 bg-white/85 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 sm:p-8">
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">نتيجة الاختبار</p>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">{result.quizTitle}</h1>

              <div
                className={`mt-6 rounded-3xl border p-6 text-center ${
                  result.passed
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                    : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30"
                }`}
              >
                <div
                  className={`text-5xl font-black ${result.passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {result.score}%
                </div>
                <p className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-200">
                  {result.passed ? "أحسنت! نجحت في الاختبار 🎉" : "تحتاج للمراجعة والمحاولة مرة أخرى"}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {result.correct} إجابة صحيحة من {result.totalQ} سؤال
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push(`/courses/${result.courseId}`)}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
                >
                  العودة للكورس
                </button>
                <button
                  onClick={() => router.push("/library")}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  مكتبتي
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">مراجعة الإجابات</h2>
              {result.breakdown.map((item, index) => (
                <article
                  key={item.questionId}
                  className={`rounded-[1.75rem] border p-5 sm:p-6 ${
                    item.isCorrect
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl font-black ${
                        item.isCorrect
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <h3 className="flex-1 text-lg font-bold leading-relaxed text-slate-900 dark:text-white">
                      {item.question}
                    </h3>
                    <span className="text-xl">{item.isCorrect ? "✓" : "✕"}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {optionLabels.map((label) => {
                      const isCorrectOption = item.correctAnswer === label;
                      const isYourAnswer = item.yourAnswer === label;
                      return (
                        <div
                          key={label}
                          className={`rounded-2xl border px-4 py-3 text-sm ${
                            isCorrectOption
                              ? "border-emerald-500 bg-emerald-100/80 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-100"
                              : isYourAnswer
                                ? "border-rose-500 bg-rose-100/80 text-rose-900 dark:border-rose-400 dark:bg-rose-500/15 dark:text-rose-100"
                                : "border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                          }`}
                        >
                          <div className="mb-1 text-xs font-bold opacity-70">{label}</div>
                          <div>{optionText(item, label)}</div>
                          {isYourAnswer && !isCorrectOption && (
                            <div className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">إجابتك</div>
                          )}
                          {isCorrectOption && (
                            <div className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              الإجابة الصحيحة
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>
          </div>
        ) : quiz ? (
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/50 bg-white/85 p-6 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">اختبار الكورس</p>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">{quiz.title}</h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {quiz.course.title} • {quiz.course.subject}
                  </p>
                </div>
                <div className="min-w-[140px] rounded-2xl bg-slate-900 px-5 py-3 text-center text-white shadow-lg dark:bg-white dark:text-slate-900">
                  <div className="text-xs opacity-80">الوقت المتبقي</div>
                  <div
                    className={`text-2xl font-black ${remainingSeconds <= 60 ? "text-rose-500 dark:text-rose-600" : ""}`}
                  >
                    {formatTime(remainingSeconds)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  عدد الأسئلة: <span className="font-bold text-slate-900 dark:text-white">{totalQuestions}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  المجاب عنها: <span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  المدة: <span className="font-bold text-slate-900 dark:text-white">{quiz.timeLimitMinutes} دقيقة</span>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {quiz.questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-[1.75rem] border border-white/60 bg-white/90 p-5 shadow-lg dark:border-white/10 dark:bg-slate-900/90 sm:p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 font-black text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                      {index + 1}
                    </span>
                    <h2 className="text-lg font-bold leading-relaxed text-slate-900 dark:text-white">
                      {question.question}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {optionLabels.map((label) => {
                      const fieldName = `option${label}` as const;
                      const active = answers[question.id] === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: label }))}
                          className={`rounded-2xl border px-4 py-4 text-right transition-all ${
                            active
                              ? "border-sky-500 bg-sky-50 text-sky-900 shadow-sm dark:border-sky-400 dark:bg-sky-500/15 dark:text-sky-100"
                              : "border-slate-200 bg-slate-50/80 text-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-sky-500/60"
                          }`}
                        >
                          <div className="mb-2 text-xs font-bold tracking-[0.2em] opacity-70">{label}</div>
                          <div className="text-sm leading-7">{question[fieldName]}</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>

            <div className="sticky bottom-4 z-10 flex justify-center">
              <div className="flex w-full max-w-3xl items-center justify-between gap-4 rounded-full border border-white/60 bg-white/90 px-4 py-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  راجعت {answeredCount} من {totalQuestions} سؤال
                </span>
                <button
                  onClick={() => submitQuiz(false)}
                  disabled={saving}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
                >
                  {saving ? "جارٍ الإرسال..." : "تسليم الاختبار"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
