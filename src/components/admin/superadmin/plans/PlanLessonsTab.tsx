"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function PlanLessonsTab({ planId }: { planId: string }) {
  const { success, error: toastError } = useToast();
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({
    title: "",
    gatesNextLesson: true,
    requiresQuiz: false,
    requiresHomework: false,
    hasProject: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchLessons = () => {
    setLoading(true);
    fetch(`/api/admin/superadmin/plans/${planId}/lessons`)
      .then(r => r.json())
      .then(data => {
        if (data.lessons) setLessons(data.lessons);
      })
      .catch(() => toastError("تعذر جلب الدروس"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLessons();
  }, [planId]);

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLesson.title.trim()) {
      toastError("عنوان الدرس مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLesson),
      });
      const data = await res.json();
      if (res.ok) {
        success(`تم إضافة الدرس "${newLesson.title}" بنجاح`);
        setNewLesson({ title: "", gatesNextLesson: true, requiresQuiz: false, requiresHomework: false, hasProject: false });
        setShowAddModal(false);
        fetchLessons();
      } else {
        toastError(data.error || "فشل إضافة الدرس");
      }
    } catch {
      toastError("حدث خطأ أثناء إضافة الدرس");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLesson = async (lesson: any) => {
    const hasProgress = lesson._count?.progress > 0;
    const confirmed = confirm(
      hasProgress
        ? `تحذير: يوجد تقدم مسجل لطلاب في هذا الدرس. هل أنت متأكد من حذف "${lesson.title}"؟ سيتطلب ذلك كلمة مرور الحماية.`
        : `هل أنت متأكد من حذف الدرس "${lesson.title}"؟`
    );
    if (!confirmed) return;

    setDeletingId(lesson.id);
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}/lessons/${lesson.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        success("تم حذف الدرس بنجاح");
        fetchLessons();
      } else if (data.code === "PASSWORD_REQUIRED") {
        const pw = prompt("أدخل كلمة مرور الحماية لحذف درس يحتوي على تقدم طلاب:");
        if (!pw) return;
        const res2 = await fetch(`/api/admin/superadmin/plans/${planId}/lessons/${lesson.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionPassword: pw }),
        });
        const data2 = await res2.json();
        if (res2.ok) {
          success("تم حذف الدرس بنجاح");
          fetchLessons();
        } else {
          toastError(data2.error || "فشل الحذف");
        }
      } else {
        toastError(data.error || "فشل حذف الدرس");
      }
    } catch {
      toastError("حدث خطأ أثناء الحذف");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="text-center py-10 text-[var(--ink-2)]">جاري التحميل...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-[var(--ink)]">الدروس ({lessons.length})</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          إضافة درس جديد
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed" style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}>
          <div className="text-4xl mb-3">📚</div>
          <div className="font-bold mb-1">لا توجد دروس بعد</div>
          <div className="text-sm">ابدأ بإضافة أول درس لهذه الخطة الدراسية</div>
        </div>
      ) : (
        <ol className="space-y-3">
          {lessons.map((lesson, idx) => (
            <li
              key={lesson.id}
              className="p-4 rounded-xl flex justify-between items-start gap-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex gap-4 flex-1 min-w-0">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--ink)] mb-1">{lesson.title}</div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {lesson.gatesNextLesson && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                        يقفل الدرس التالي
                      </span>
                    )}
                    {lesson.requiresQuiz && (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">اختبار مطلوب</span>
                    )}
                    {lesson.requiresHomework && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">واجب مطلوب</span>
                    )}
                    {lesson.hasProject && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">مشروع AI</span>
                    )}
                  </div>
                  {/* Sources preview */}
                  {lesson.sources && lesson.sources.length > 0 && (
                    <div className="mt-2 text-xs text-[var(--ink-3)]">
                      <span className="font-semibold">المصادر: </span>
                      {lesson.sources.map((s: any) => (
                        <span
                          key={s.id}
                          className={`inline-block mr-2 px-1.5 py-0.5 rounded ${s.isDefault ? "bg-green-100 text-green-700 font-bold" : "bg-gray-100 text-gray-500"}`}
                        >
                          {s.video?.title || "فيديو"}{s.isDefault ? " ✓" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {lesson.quizzes && lesson.quizzes.length > 0 && (
                    <div className="mt-1 text-xs text-[var(--ink-3)]">
                      <span className="font-semibold">الاختبارات: </span>
                      {lesson.quizzes.map((q: any) => (
                        <span key={q.id} className="inline-block mr-2 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">
                          {q.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDeleteLesson(lesson)}
                disabled={deletingId === lesson.id}
                className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer font-bold text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {deletingId === lesson.id ? "جاري..." : "حذف"}
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Add Lesson Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-base font-black text-[var(--ink)]">إضافة درس جديد</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddLesson} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-[var(--ink)]">عنوان الدرس</label>
                <input
                  type="text"
                  value={newLesson.title}
                  onChange={e => setNewLesson({ ...newLesson, title: e.target.value })}
                  placeholder="مثال: الدرس الأول — المقدمة"
                  className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)] text-sm"
                  style={{ borderColor: "var(--border)" }}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-wide">خيارات بوابات التقدم</p>

                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLesson.gatesNextLesson}
                    onChange={e => setNewLesson({ ...newLesson, gatesNextLesson: e.target.checked })}
                    className="w-4 h-4"
                  />
                  يجب إكماله قبل الانتقال للدرس التالي (بوابة)
                </label>

                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLesson.requiresQuiz}
                    onChange={e => setNewLesson({ ...newLesson, requiresQuiz: e.target.checked })}
                    className="w-4 h-4"
                  />
                  يتطلب اجتياز اختبار (Quiz)
                </label>

                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLesson.requiresHomework}
                    onChange={e => setNewLesson({ ...newLesson, requiresHomework: e.target.checked })}
                    className="w-4 h-4"
                  />
                  يتطلب تسليم واجب (Homework)
                </label>

                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLesson.hasProject}
                    onChange={e => setNewLesson({ ...newLesson, hasProject: e.target.checked })}
                    className="w-4 h-4"
                  />
                  يحتوي على مشروع AI للتقييم
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm border-none cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {submitting ? "جاري الإضافة..." : "إضافة الدرس"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-[var(--ink-2)] font-bold rounded-xl text-sm border-none cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
