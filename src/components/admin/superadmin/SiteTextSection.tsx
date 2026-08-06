"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export function SiteTextSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [actionPassword, setActionPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/superadmin/site-text", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error ?? "تعذر تحميل النصوص");
        return;
      }
      setValues(json.text ?? {});
      setDefaults(json.defaults ?? {});
      setLabels(json.labels ?? {});
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async () => {
    if (!actionPassword) {
      toastError("أدخل كلمة مرور المشرف");
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
      toastSuccess("تم حفظ نصوص الموقع — قد تستغرق التحديث دقيقة على الموقع");
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const keys = Object.keys(labels);

  return (
    <div className="max-w-2xl space-y-5" dir="rtl">
      <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
        <h2 className="font-bold text-white">نصوص الموقع</h2>
        <p className="text-xs text-gray-400">
          عدّل النصوص الظاهرة للزوّار (العنوان التعريفي، بيانات التواصل، دعوة التسجيل) دون لمس الكود.
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">جارٍ التحميل...</div>
      ) : (
        <>
          {keys.map((k) => {
            const isShort = k === "contact_email" || k === "contact_phone" || k === "contact_heading";
            return (
              <div key={k} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <label className="mb-1 block text-sm font-semibold text-gray-200">{labels[k]}</label>
                {isShort ? (
                  <input
                    value={values[k] ?? ""}
                    onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                ) : (
                  <textarea
                    value={values[k] ?? ""}
                    onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                )}
                {defaults[k] !== undefined && values[k] !== defaults[k] && (
                  <button
                    onClick={() => setValues({ ...values, [k]: defaults[k] })}
                    className="mt-1 text-[11px] text-gray-500 hover:text-gray-300"
                  >
                    استعادة الافتراضي
                  </button>
                )}
              </div>
            );
          })}

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
            <label className="mb-1 block text-xs text-gray-400">كلمة مرور المشرف</label>
            <input
              type="password"
              value={actionPassword}
              onChange={(e) => setActionPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              onClick={save}
              disabled={saving}
              className="mt-3 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
