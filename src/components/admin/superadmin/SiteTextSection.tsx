"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { FileText, Save, RotateCcw, Lock } from "lucide-react";

export function SiteTextSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [actionPassword, setActionPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await fetch("/api/admin/superadmin/site-text", { credentials: "include" });
        const json = await res.json();
        if (!isMounted) return;
        if (!res.ok) {
          toastError(json.error ?? "تعذر تحميل النصوص");
          return;
        }
        setValues(json.text ?? {});
        setDefaults(json.defaults ?? {});
        setLabels(json.labels ?? {});
      } catch {
        if (isMounted) toastError("تعذر الاتصال بالخادم");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => {
      isMounted = false;
    };
  }, [toastError]);

  const save = async () => {
    if (!actionPassword) {
      toastError("أدخل كلمة مرور المشرف لتأكيد الحفظ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/superadmin/site-text", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: values, actionPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error ?? "تعذر الحفظ");
        return;
      }
      setValues(json.text ?? values);
      toastSuccess("تم حفظ نصوص الموقع بنجاح — قد تستغرق التحديث دقيقة على الموقع");
      setActionPassword("");
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const keys = Object.keys(labels);

  return (
    <div className="max-w-4xl space-y-6" dir="rtl">
      {/* Header Info Card (Clean White / Pure Dark) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 transition-all">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">نصوص وواجهات الموقع العامة</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تعديل مباشر لجميع النصوص والبيانات الظاهرة للزوّار والطلاب (العنوان الرئيسي، وسائل التواصل، روابط الدعم) دون لمس الكود.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold">جارٍ تحميل نصوص الموقع...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => {
            const isShort = k === "contact_email" || k === "contact_phone" || k === "contact_heading";
            return (
              <div
                key={k}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    {labels[k]}
                  </label>
                  {defaults[k] !== undefined && values[k] !== defaults[k] && (
                    <button
                      type="button"
                      onClick={() => setValues({ ...values, [k]: defaults[k] })}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>استعادة الافتراضي</span>
                    </button>
                  )}
                </div>

                {isShort ? (
                  <input
                    value={values[k] ?? ""}
                    onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-700 transition-all"
                  />
                ) : (
                  <textarea
                    value={values[k] ?? ""}
                    onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-700 transition-all"
                  />
                )}
              </div>
            );
          })}

          {/* Confirmation & Save Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-slate-500" />
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                كلمة مرور المشرف العام لتأكيد الحفظ
              </label>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="password"
                value={actionPassword}
                onChange={(e) => setActionPassword(e.target.value)}
                placeholder="أدخل كلمة مرور المشرف للتأكيد..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-700 transition-all"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
