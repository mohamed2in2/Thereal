"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface Feedback {
  id: string;
  type: string;
  rating: number | null;
  content: string;
  isResolved: boolean;
  resolution: string | null;
  createdAt: string;
  student: { name: string; phone: string | null; educationalStage: string | null };
  course: { title: string };
}

const TYPE_LABELS: Record<string, string> = {
  teacher_rating: "تقييم المعلم",
  course_feedback: "ملاحظة على الكورس",
  took_elsewhere: "يأخذ مع مدرس آخر",
  difficulty: "صعوبة المحتوى",
  other: "أخرى",
};

const TYPE_COLORS: Record<string, string> = {
  teacher_rating: "bg-amber-600/20 text-amber-300 border-amber-600/30",
  course_feedback: "bg-blue-600/20 text-blue-300 border-blue-600/30",
  took_elsewhere: "bg-orange-600/20 text-orange-300 border-orange-600/30",
  difficulty: "bg-purple-600/20 text-purple-300 border-purple-600/30",
  other: "bg-gray-600/20 text-gray-300 border-slate-300 dark:border-gray-600/30",
};

export function TeacherFeedback() {
  const { success, error } = useToast();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/feedback${unresolvedOnly ? "?unresolved=true" : ""}`);
      const data = await res.json();
      setFeedback(data.feedback || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [unresolvedOnly]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/teacher/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, isResolved: true, resolution }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشل");
        return;
      }
      success("تم تحديث الملاحظة");
      setSelected(null);
      setResolution("");
      load();
    } catch {
      error("حدث خطأ");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
            className="rounded"
          />
          الملاحظات غير المُعالَجة فقط
        </label>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-gray-400">جارٍ التحميل...</div>
      ) : feedback.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
          لا توجد ملاحظات
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white">{f.student.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${TYPE_COLORS[f.type] || TYPE_COLORS.other}`}>
                      {TYPE_LABELS[f.type] || f.type}
                    </span>
                    {f.rating !== null && (
                      <span className="text-amber-400 text-sm">
                        {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                      </span>
                    )}
                    {f.isResolved && (
                      <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs rounded-full border border-emerald-600/40">
                        ✓ مُعالَج
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {f.course.title}
                    {f.student.educationalStage && ` · ${f.student.educationalStage}`}
                    {" · "}
                    {new Date(f.createdAt).toLocaleString("ar-EG")}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900/60 rounded-xl p-3 mb-3">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{f.content}</p>
              </div>

              {f.resolution && (
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 mb-3">
                  <p className="text-xs text-emerald-300 mb-1">ردك:</p>
                  <p className="text-sm text-gray-200">{f.resolution}</p>
                </div>
              )}

              {!f.isResolved && (
                <button
                  onClick={() => { setSelected(f); setResolution(""); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-bold"
                >
                  الرد ووضع كمُعالَج
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">الرد على الملاحظة</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{selected.student.name} · {selected.course.title}</p>

            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-white mb-5"
              placeholder="اكتب ردك على المتعلم..."
            />

            <div className="flex gap-2">
              <button onClick={handleResolve} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">
                ✓ حفظ ووضع كمُعالَج
              </button>
              <button onClick={() => setSelected(null)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
