"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function ParentVerificationBanner({ isStudent = false }: { isStudent?: boolean }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [showBanner, setShowBanner] = useState(false);
  const [parentPhone, setParentPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isStudent) {
      setShowBanner(false);
      return;
    }

    fetch("/api/student/stats", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { parentVerificationStatus?: string; parentVerified?: boolean; parentPhone?: string } | null) => {
        if (data && data.parentVerificationStatus === "REJECTED" && !data.parentVerified) {
          setShowBanner(true);
          if (data.parentPhone) setParentPhone(data.parentPhone);
        } else {
          setShowBanner(false);
        }
      })
      .catch(() => {});
  }, [isStudent]);

  if (!showBanner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentPhone.trim()) {
      toastError("يرجى إدخال رقم ولي الأمر");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/parent-phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPhone }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال الرابط");
      }
      toastSuccess(data.message || "تم إرسال رابط متابعة جديد لولي أمرك عبر الواتساب بنجاح");
    } catch (err: any) {
      toastError(err?.message || "حدث خطأ أثناء إرسال الرابط");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-red-600 text-white px-4 py-3 border-b-2 border-red-700 font-sans shadow-md" dir="rtl">
      <div className="max-w-[1320px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-xl">⚠️</span>
          <span>
            محتاجين رقم ولي أمرك الحقيقي: الرقم المسجل أفاد بأنه ليس ولي أمرك. يرجى إضافة الرقم الصحيح لإرسال رابط المتابعة.
          </span>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <input
            type="text"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-mono font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 w-full md:w-44"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold text-xs whitespace-nowrap transition-colors shadow-sm"
          >
            {submitting ? "جارٍ الإرسال..." : "إرسال الرابط لولي أمري"}
          </button>
        </form>
      </div>
    </div>
  );
}
