"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface QuizResultItem {
  id: string;
  studentId: string;
  student: { id: string; name: string; email: string; phone: string | null };
  quizId: string;
  quiz: { id: string; title: string; folderName: string; courseId: string; courseTitle: string };
  score: number;
  totalQ: number;
  allowRetake: boolean;
  completedAt: string;
}

export function TeacherQuizResults() {
  const { success, error } = useToast();
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterCourse, setFilterCourse] = useState("");
  const [filterQuiz, setFilterQuiz] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterCourse) params.set("courseId", filterCourse);
        if (filterQuiz) params.set("quizId", filterQuiz);
        const res = await fetch(`/api/admin/quiz-results?${params}`);
        const data = await res.json();
        if (!cancelled) setResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchResults();
    return () => { cancelled = true; };
  }, [filterCourse, filterQuiz]);

  const toggleRetake = async (resultId: string, allow: boolean) => {
    setToggling(resultId);
    try {
      const res = await fetch("/api/admin/quiz-results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, allowRetake: allow }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشل");
        return;
      }
      success(data.message);
      setResults((prev) =>
        prev.map((r) => (r.id === resultId ? { ...r, allowRetake: allow } : r))
      );
    } catch {
      error("حدث خطأ");
    } finally {
      setToggling(null);
    }
  };

  // Derive unique courses and quizzes for filters
  const courses = Array.from(new Map(results.map((r) => [r.quiz.courseId, r.quiz.courseTitle])).entries());
  const quizzes = Array.from(
    new Map(
      results
        .filter((r) => !filterCourse || r.quiz.courseId === filterCourse)
        .map((r) => [r.quizId, r.quiz.title])
    ).entries()
  );

  const filtered = results.filter((r) => {
    if (filterCourse && r.quiz.courseId !== filterCourse) return false;
    if (filterQuiz && r.quizId !== filterQuiz) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.student.name.toLowerCase().includes(s) ||
        r.student.email.toLowerCase().includes(s) ||
        (r.student.phone || "").includes(s)
      );
    }
    return true;
  });

  const avgScore = filtered.length > 0 ? Math.round(filtered.reduce((a, r) => a + r.score, 0) / filtered.length) : 0;
  const passCount = filtered.filter((r) => r.score >= 50).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">📝 نتائج الاختبارات</h2>
        <div className="mr-auto flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
          <span>{filtered.length} نتيجة</span>
          <span>•</span>
          <span>متوسط {avgScore}%</span>
          <span>•</span>
          <span>{passCount} ناجح</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCourse}
          onChange={(e) => {
            setFilterCourse(e.target.value);
            setFilterQuiz("");
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-white text-sm"
        >
          <option value="">كل الكورسات</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <select
          value={filterQuiz}
          onChange={(e) => setFilterQuiz(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-white text-sm"
        >
          <option value="">كل الاختبارات</option>
          {quizzes.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-white text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-gray-400">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
          لا توجد نتائج اختبارات
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 flex items-center gap-4 flex-wrap"
            >
              {/* Student info */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 dark:text-white">{r.student.name}</span>
                  {r.allowRetake && (
                    <span className="px-2 py-0.5 bg-amber-600/20 text-amber-300 text-xs rounded-full border border-amber-600/30">
                      🔓 مسموح بالإعادة
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {r.student.email}
                  {r.student.phone && ` · ${r.student.phone}`}
                </p>
              </div>

              {/* Quiz info */}
              <div className="min-w-[180px]">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{r.quiz.title}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">{r.quiz.courseTitle} · {r.quiz.folderName}</p>
              </div>

              {/* Score */}
              <div className="text-center min-w-[80px]">
                <div
                  className={`text-2xl font-black ${
                    r.score >= 80
                      ? "text-emerald-400"
                      : r.score >= 50
                        ? "text-sky-400"
                        : "text-rose-400"
                  }`}
                >
                  {Math.round(r.score)}%
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-500">
                  {r.score >= 50 ? "ناجح" : "راسب"}
                </p>
              </div>

              {/* Date */}
              <div className="text-xs text-slate-500 dark:text-gray-500 min-w-[100px] text-center">
                {new Date(r.completedAt).toLocaleDateString("ar-EG")}
              </div>

              {/* Retake toggle */}
              <button
                onClick={() => toggleRetake(r.id, !r.allowRetake)}
                disabled={toggling === r.id}
                className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors min-w-[130px] ${
                  r.allowRetake
                    ? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                } ${toggling === r.id ? "opacity-50" : ""}`}
              >
                {toggling === r.id
                  ? "جارٍ..."
                  : r.allowRetake
                    ? "🔒 إلغاء الإعادة"
                    : "🔓 السماح بالإعادة"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
