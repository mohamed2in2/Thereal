"use client";

import { useState, useEffect, useCallback } from "react";

type VideoResponseItem = {
  id: string;
  selectedOption: string | null;
  essayAnswer: string | null;
  isCorrect: boolean;
  status: "PENDING" | "APPROVED" | "DISAPPROVED";
  teacherReply: string | null;
  answeredAtSecond: number;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  videoQuestion: {
    id: string;
    questionText: string;
    questionType: string;
    triggerSecond: number;
    video: {
      id: string;
      title: string;
      folder: {
        course: {
          id: string;
          title: string;
        };
      };
    };
  };
};

type QuizAnswerItem = {
  id: string;
  question: string;
  questionType: string;
  essayAnswer: string | null;
  selectedAnswer: string | null;
  isCorrect: boolean;
  status: "PENDING" | "APPROVED" | "DISAPPROVED";
  teacherReply: string | null;
  createdAt: string;
  result: {
    id: string;
    score: number;
    totalQ: number;
    quiz: {
      id: string;
      title: string;
      folder: {
        course: {
          id: string;
          title: string;
        };
      };
    };
    student: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
  };
};

export function InVideoResponsesSection() {
  const [sourceTab, setSourceTab] = useState<"video" | "quiz">("quiz");
  const [videoResponses, setVideoResponses] = useState<VideoResponseItem[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      if (sourceTab === "video") {
        const res = await fetch(`/api/admin/teacher/in-video-responses?status=${statusFilter}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.responses) {
          setVideoResponses(data.responses);
        }
      } else {
        const res = await fetch(`/api/admin/teacher/quiz-essay-responses?status=${statusFilter}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.answers) {
          setQuizAnswers(data.answers);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sourceTab, statusFilter]);

  useEffect(() => {
    void fetchResponses();
  }, [fetchResponses]);

  const handleGradeVideo = async (responseId: string, status: "APPROVED" | "DISAPPROVED") => {
    setSubmittingId(responseId);
    try {
      const res = await fetch("/api/admin/teacher/in-video-responses", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseId,
          status,
          teacherReply: replyText[responseId] || "",
        }),
      });
      if (res.ok) {
        setReplyText((prev) => {
          const next = { ...prev };
          delete next[responseId];
          return next;
        });
        void fetchResponses();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingId(null);
    }
  };

  const handleGradeQuiz = async (answerId: string, status: "APPROVED" | "DISAPPROVED") => {
    setSubmittingId(answerId);
    try {
      const res = await fetch("/api/admin/teacher/quiz-essay-responses", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          status,
          teacherReply: replyText[answerId] || "",
        }),
      });
      if (res.ok) {
        setReplyText((prev) => {
          const next = { ...prev };
          delete next[answerId];
          return next;
        });
        void fetchResponses();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Source Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)]">
        <div>
          <h2 className="text-lg font-black text-[var(--ink)] flex items-center gap-2">
            <span>📝 تصحيح الأسئلة المقالية</span>
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            تصحيح ومراجعة الإجابات المقالية للطلاب في الاختبارات وفي الفيديوهات ورصد الدرجات والرد بملاحظات.
          </p>
        </div>

        {/* Source Tab Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <button
              onClick={() => setSourceTab("quiz")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sourceTab === "quiz"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              📝 أسئلة الاختبارات
            </button>
            <button
              onClick={() => setSourceTab("video")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sourceTab === "video"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              🎬 أسئلة الفيديو
            </button>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl shrink-0">
            {[
              { id: "PENDING", label: "معلقة" },
              { id: "APPROVED", label: "مقبولة" },
              { id: "DISAPPROVED", label: "مرفوضة" },
              { id: "all", label: "الكل" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? "bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--ink-muted)]">
          <span className="inline-block w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin me-2 align-middle" />
          جارٍ تحميل الإجابات المقالية...
        </div>
      ) : sourceTab === "quiz" ? (
        /* QUIZ ESSAY ANSWERS LIST */
        quizAnswers.length === 0 ? (
          <div className="bg-[var(--surface)] p-12 rounded-2xl border border-[var(--border)] text-center text-[var(--ink-muted)] space-y-2">
            <p className="text-3xl">📝</p>
            <p className="font-bold text-[var(--ink)]">لا توجد إجابات مقالية للاختبارات {statusFilter === "PENDING" ? "معلقة" : ""}</p>
            <p className="text-xs">عندما يقوم الطلاب بحل الأسئلة المقالية في الاختبارات ستظهر إجاباتهم هنا لتصحيحها.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quizAnswers.map((item) => {
              const quiz = item.result.quiz;
              const courseTitle = quiz.folder?.course?.title || "الكورس";
              const student = item.result.student;

              return (
                <div
                  key={item.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 relative shadow-sm"
                >
                  {/* Info Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-sm shrink-0">
                        👤
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--ink)]">{student.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {student.email} {student.phone ? `· ${student.phone}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-purple-500/10 text-purple-500 px-2.5 py-1 rounded-lg font-bold">
                        {courseTitle}
                      </span>
                      <span className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1 rounded-lg text-[var(--ink-muted)] font-bold">
                        📝 اختبار: {quiz.title}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          item.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : item.status === "DISAPPROVED"
                            ? "bg-red-500/15 text-red-500"
                            : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        {item.status === "APPROVED"
                          ? "مقبول ✓"
                          : item.status === "DISAPPROVED"
                          ? "مرفوض ✗"
                          : "قيد التصحيح ⏳"}
                      </span>
                    </div>
                  </div>

                  {/* Question & Student Answer */}
                  <div className="space-y-2 bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--ink-muted)] font-bold">السؤال المقالي في الاختبار:</p>
                    <p className="text-sm font-bold text-[var(--ink)]">{item.question}</p>

                    <div className="pt-2 border-t border-[var(--border)]/60">
                      <p className="text-xs text-[var(--ink-muted)] font-bold mb-1">إجابة الطالب النصية:</p>
                      <p className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]">
                        {item.essayAnswer || item.selectedAnswer || "لم يتم إدخال إجابة"}
                      </p>
                    </div>
                  </div>

                  {/* Teacher Feedback / Reply */}
                  {item.teacherReply && (
                    <div className="bg-purple-500/5 border border-purple-500/20 p-3.5 rounded-xl text-xs space-y-1">
                      <p className="font-bold text-purple-500">ملاحظات تصحيح المعلم السابقة:</p>
                      <p className="text-[var(--ink)]">{item.teacherReply}</p>
                    </div>
                  )}

                  {/* Grading Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="اكتب درجة أو ملاحظة رد للطالب (تصل للطالب فوراً)..."
                      value={replyText[item.id] ?? ""}
                      onChange={(e) => setReplyText({ ...replyText, [item.id]: e.target.value })}
                      className="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:border-purple-400"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleGradeQuiz(item.id, "APPROVED")}
                        disabled={submittingId === item.id}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <span>قبول الإجابة ✓</span>
                      </button>
                      <button
                        onClick={() => handleGradeQuiz(item.id, "DISAPPROVED")}
                        disabled={submittingId === item.id}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <span>عدم الاعتماد ✗</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* IN-VIDEO ESSAY ANSWERS LIST */
        videoResponses.length === 0 ? (
          <div className="bg-[var(--surface)] p-12 rounded-2xl border border-[var(--border)] text-center text-[var(--ink-muted)] space-y-2">
            <p className="text-3xl">🎬</p>
            <p className="font-bold text-[var(--ink)]">لا توجد إجابات لأسئلة الفيديو {statusFilter === "PENDING" ? "معلقة" : ""}</p>
            <p className="text-xs">عندما يجيب الطلاب على الأسئلة المقالية في الفيديوهات ستظهر هنا.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {videoResponses.map((resp) => {
              const video = resp.videoQuestion.video;
              const course = video.folder.course;
              const timeFmt = `${Math.floor(resp.videoQuestion.triggerSecond / 60)}:${String(
                resp.videoQuestion.triggerSecond % 60
              ).padStart(2, "0")}`;

              return (
                <div
                  key={resp.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 relative shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-sm shrink-0">
                        👤
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[var(--ink)]">{resp.student.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {resp.student.email} {resp.student.phone ? `· ${resp.student.phone}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-sky-500/10 text-sky-500 px-2.5 py-1 rounded-lg font-bold">
                        {course.title}
                      </span>
                      <span className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1 rounded-lg text-[var(--ink-muted)]">
                        🎬 {video.title} (⏱ {timeFmt})
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          resp.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : resp.status === "DISAPPROVED"
                            ? "bg-red-500/15 text-red-500"
                            : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        {resp.status === "APPROVED"
                          ? "مقبول ✓"
                          : resp.status === "DISAPPROVED"
                          ? "مرفوض ✗"
                          : "قيد المراجعة ⏳"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--ink-muted)] font-bold">السؤال:</p>
                    <p className="text-sm font-bold text-[var(--ink)]">{resp.videoQuestion.questionText}</p>

                    <div className="pt-2 border-t border-[var(--border)]/60">
                      <p className="text-xs text-[var(--ink-muted)] font-bold mb-1">إجابة الطالب:</p>
                      <p className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]">
                        {resp.essayAnswer || resp.selectedOption || "بدون نص"}
                      </p>
                    </div>
                  </div>

                  {resp.teacherReply && (
                    <div className="bg-sky-500/5 border border-sky-500/20 p-3.5 rounded-xl text-xs space-y-1">
                      <p className="font-bold text-sky-500">ملاحظات المعلم السابقة:</p>
                      <p className="text-[var(--ink)]">{resp.teacherReply}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="اكتب ملاحظة أو رسالة رد للطالب (اختياري)..."
                      value={replyText[resp.id] ?? ""}
                      onChange={(e) => setReplyText({ ...replyText, [resp.id]: e.target.value })}
                      className="flex-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:border-sky-400"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleGradeVideo(resp.id, "APPROVED")}
                        disabled={submittingId === resp.id}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <span>قبول ✓</span>
                      </button>
                      <button
                        onClick={() => handleGradeVideo(resp.id, "DISAPPROVED")}
                        disabled={submittingId === resp.id}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <span>رفض ✗</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
