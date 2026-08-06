"use client";
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { hasPermission } from "@/lib/rbac";

interface DeletedTeacher {
  id: string;
  name: string;
  email: string;
  deletedAt: string | null;
  createdAt: string;
  _count?: { courses: number };
}

type ModalAction = { type: "restore" | "hard_delete"; teacher: DeletedTeacher } | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
}

function daysLeft(deletedAt: string | null, graceDays: number) {
  if (!deletedAt) return graceDays;
  const purgeAt = new Date(deletedAt).getTime() + graceDays * 86400000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86400000));
}

export function DeletedTeachersSection({ userRole = "superadmin" }: { userRole?: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [teachers, setTeachers] = useState<DeletedTeacher[]>([]);
  const [graceDays, setGraceDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction>(null);

  // Editable grace period (superadmin setting)
  const [draftDays, setDraftDays] = useState("7");
  const [bounds, setBounds] = useState({ min: 1, max: 365 });
  const [savingDays, setSavingDays] = useState(false);
  const canEdit = hasPermission(userRole, "delete_teacher");

  useEffect(() => {
    fetch("/api/admin/superadmin/settings/grace-days", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { graceDays?: number; min?: number; max?: number } | null) => {
        if (!d) return;
        if (typeof d.graceDays === "number") { setGraceDays(d.graceDays); setDraftDays(String(d.graceDays)); }
        if (typeof d.min === "number" && typeof d.max === "number") setBounds({ min: d.min, max: d.max });
      })
      .catch(() => {});
  }, []);

  const saveGraceDays = async () => {
    const n = parseInt(draftDays, 10);
    if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) {
      toastError(`عدد الأيام يجب أن يكون بين ${bounds.min} و ${bounds.max}`);
      return;
    }
    setSavingDays(true);
    try {
      const res = await fetch("/api/admin/superadmin/settings/grace-days", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graceDays: n }),
      });
      const json = (await res.json()) as { graceDays?: number; error?: string };
      if (!res.ok) { toastError(json.error ?? "تعذر حفظ الإعداد"); return; }
      setGraceDays(json.graceDays ?? n);
      setDraftDays(String(json.graceDays ?? n));
      toastSuccess(`تم ضبط مهلة الحذف على ${json.graceDays ?? n} يوم`);
    } finally {
      setSavingDays(false);
    }
  };

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/superadmin/teachers/deleted", { credentials: "include" });
      const data = (await res.json()) as { teachers?: DeletedTeacher[]; graceDays?: number };
      if (res.ok) {
        setTeachers(data.teachers ?? []);
        setGraceDays(data.graceDays ?? 7);
        setSearched(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRestore = async (password: string) => {
    if (!modalAction || modalAction.type !== "restore") return;
    const { teacher } = modalAction;
    const res = await fetch(`/api/admin/superadmin/teachers/${teacher.id}/restore`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: password }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر استعادة الحساب");
    toastSuccess(`تم استعادة المعلم ${teacher.name} وكل كورساته`);
    setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
    setModalAction(null);
  };

  const handleHardDelete = async (password: string) => {
    if (!modalAction || modalAction.type !== "hard_delete") return;
    const { teacher } = modalAction;
    const res = await fetch(`/api/admin/superadmin/teachers/${teacher.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: password }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر الحذف النهائي");
    toastSuccess(`تم حذف المعلم ${teacher.name} نهائياً`);
    setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
    setModalAction(null);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-300 font-medium">المعلمون المحذوفون</p>
          <p className="text-xs text-gray-500 mt-0.5">يُحذف المعلم نهائياً بعد {graceDays} {graceDays === 1 ? "يوم" : "أيام"} من الحذف ما لم تتم استعادته.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded-xl px-2 py-1">
              <label className="text-xs text-gray-400">مهلة الحذف:</label>
              <input
                type="number"
                min={bounds.min}
                max={bounds.max}
                value={draftDays}
                onChange={(e) => setDraftDays(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                dir="ltr"
              />
              <span className="text-xs text-gray-400">يوم</span>
              <button
                onClick={saveGraceDays}
                disabled={savingDays || draftDays === String(graceDays)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {savingDays ? "..." : "حفظ"}
              </button>
            </div>
          )}
          <button
            onClick={fetchDeleted}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "جارٍ التحميل..." : "تحديث القائمة"}
          </button>
        </div>
      </div>

      {searched && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
            <span className="text-orange-400">🗑️</span>
            <p className="text-sm text-gray-300 font-medium">المعلمون المؤرشفون ({teachers.length})</p>
          </div>

          {teachers.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p>لا يوجد معلمون مؤرشفون</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {teachers.map((t) => {
                const left = daysLeft(t.deletedAt, graceDays);
                const urgent = left <= 2;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 font-bold shrink-0">
                        {t.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{t.name}</p>
                        <p className="text-gray-500 text-xs">{t._count?.courses ?? 0} كورس · أُرشف: {fmtDate(t.deletedAt)}</p>
                        <p className={`text-xs font-semibold mt-0.5 ${urgent ? "text-red-400" : "text-amber-400"}`}>
                          {left > 0 ? `يُحذف نهائياً خلال ${left} ${left === 1 ? "يوم" : "أيام"}` : "سيُحذف عند التحديث القادم"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {hasPermission(userRole, "delete_teacher") && (
                        <>
                          <button
                            onClick={() => setModalAction({ type: "restore", teacher: t })}
                            className="px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                          >
                            ↩️ استعادة
                          </button>
                          <button
                            onClick={() => setModalAction({ type: "hard_delete", teacher: t })}
                            className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                          >
                            🗑️ حذف نهائي
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-10 text-center text-gray-500">
          <div className="text-4xl mb-2">🗑️</div>
          <p>اضغط &quot;تحديث القائمة&quot; لعرض المعلمين المؤرشفين</p>
        </div>
      )}

      {modalAction?.type === "restore" && (
        <ConfirmActionModal
          title="استعادة حساب المعلم"
          description={`سيُعاد تفعيل حساب المعلم "‏${modalAction.teacher.name}‏" وستظهر كل كورساته مجدداً ويستطيع تسجيل الدخول.`}
          actionLabel="استعادة الحساب"
          variant="warning"
          onConfirm={handleRestore}
          onClose={() => setModalAction(null)}
        />
      )}

      {modalAction?.type === "hard_delete" && (
        <ConfirmActionModal
          title="حذف نهائي — لا يمكن التراجع"
          description={`تحذير: سيتم حذف المعلم "‏${modalAction.teacher.name}‏" وكل كورساته ومحتواه بصورة نهائية تماماً غير قابلة للاسترداد.`}
          actionLabel="حذف نهائياً"
          variant="danger"
          onConfirm={handleHardDelete}
          onClose={() => setModalAction(null)}
        />
      )}
    </div>
  );
}
