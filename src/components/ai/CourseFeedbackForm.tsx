"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  onClose?: () => void;
  onSubmitted?: () => void;
}

const FEEDBACK_TYPES = [
  { value: "teacher_rating", label: "تقييم المعلم", icon: "⭐" },
  { value: "course_feedback", label: "ملاحظة على المحتوى", icon: "📚" },
  { value: "took_elsewhere", label: "أخذت الكورس مع مدرس آخر", icon: "🔄" },
  { value: "difficulty", label: "صعوبة المحتوى", icon: "🤔" },
  { value: "other", label: "ملاحظة أخرى", icon: "💬" },
];

export function CourseFeedbackForm({ courseId, courseTitle, teacherName, onClose, onSubmitted }: Props) {
  const { success, error } = useToast();
  const [type, setType] = useState("teacher_rating");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 10) {
      error("اكتب رأيك بشكل أوضح (10 حروف على الأقل)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          type,
          content,
          rating: type === "teacher_rating" ? rating : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشل");
        return;
      }
      success(data.message || "تم إرسال ملاحظتك");
      setContent("");
      onSubmitted?.();
      onClose?.();
    } catch {
      error("حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-purple-200 dark:border-purple-800/40 p-5 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">شاركنا رأيك</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {courseTitle} · {teacherName}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            نوع الملاحظة
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`text-right px-3 py-2 rounded-xl text-xs border transition-colors ${
                  type === t.value
                    ? "bg-purple-100 dark:bg-purple-900/40 border-purple-400 text-purple-800 dark:text-purple-200 font-bold"
                    : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-purple-300"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rating (only for teacher_rating) */}
        {type === "teacher_rating" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              التقييم
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    n <= rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ملاحظتك
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder={
              type === "took_elsewhere"
                ? "اشرح مع مين بتاخد ومتى عشان نعدل خطة دراستك..."
                : type === "teacher_rating"
                ? "إيه رأيك في طريقة شرح المعلم؟"
                : "اكتب ملاحظتك بالتفصيل..."
            }
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-xs text-purple-800 dark:text-purple-200">
          🤖 المرشد الذكي هيقرأ ملاحظتك ويعدل خطتك التدريبية ويوصلها للمعلم.
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-md"
        >
          {submitting ? "جارٍ الإرسال..." : "إرسال الملاحظة"}
        </button>
      </form>
    </div>
  );
}
