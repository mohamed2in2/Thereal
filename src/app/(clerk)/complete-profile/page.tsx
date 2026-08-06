"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { EDUCATIONAL_STAGES } from "@/types";
import { fetchMeWithRetry } from "@/lib/fetch-me";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    age: "",
    educationalStage: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const user = await fetchMeWithRetry(10, 300);

      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      if (user.profileCompleted) {
        router.replace("/");
        return;
      }

      setForm({
        name: user.name || "",
        phone: user.phone || "",
        parentPhone: user.parentPhone || "",
        age: user.age ? String(user.age) : "",
        educationalStage: user.educationalStage || "",
      });
      setInitialLoading(false);
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (form.phone.trim() === form.parentPhone.trim()) {
      setError("رقم المتعلم لا يمكن أن يكون نفس رقم الوالد/الوالدة");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "فشل في حفظ البيانات");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("حدث خطأ. يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="إكمال البيانات الشخصية"
      subtitle="خطوة أخيرة — أكمل بياناتك للوصول إلى الكورسات والمحتوى"
      maxWidth="2xl"
      footer="بياناتك الشخصية آمنة وسرية. لا نشاركها إلا مع فريق التدريس."
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl p-6 sm:p-8">
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm"
          >
            {error}
          </div>
        )}

        {initialLoading ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">جاري تحميل بياناتك...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم الهاتف (المتعلم)</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-left"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم هاتف الوالد/الوالدة</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={form.parentPhone}
                  onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-left"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">السن</label>
                <input
                  type="number"
                  required
                  min={6}
                  max={25}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">المرحلة التدريبية</label>
                <select
                  required
                  value={form.educationalStage}
                  onChange={(e) => setForm({ ...form, educationalStage: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">— اختر المرحلة التدريبية —</option>
                  {EDUCATIONAL_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-l from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-md"
            >
              {loading ? "جاري حفظ البيانات..." : "إكمال البيانات والمتابعة"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
