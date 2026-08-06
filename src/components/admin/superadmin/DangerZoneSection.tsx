"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmActionModal } from "./ConfirmActionModal";

type Scope = "all" | "students" | "teachers";

interface BulkRequest {
  id: string;
  scope: Scope;
  status: "pending" | "executed" | "cancelled";
  instant: boolean;
  requestedByName: string;
  requestedAt: string;
  executeAt: string;
  executedAt: string | null;
  affectedCount: number | null;
}

interface DangerData {
  requests: BulkRequest[];
  counts: { students: number; teachers: number; all: number };
  graceDays: number;
  purgeDays: number;
  instantConfigured: boolean;
}

const SCOPE_LABEL: Record<Scope, string> = {
  all: "كل المتعلمين والمعلمين",
  students: "المتعلمين فقط",
  teachers: "المعلمين فقط",
};

const CONFIRM_WORD = "حذف";

function fmtCountdown(target: string, nowMs: number): string {
  const diff = new Date(target).getTime() - nowMs;
  if (diff <= 0) return "جارٍ التنفيذ...";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d} يوم ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DangerZoneSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [data, setData] = useState<DangerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Create-request modal
  const [scope, setScope] = useState<Scope | null>(null);
  const [mode, setMode] = useState<"schedule" | "instant">("schedule");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<BulkRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/superadmin/bulk-deletion", { credentials: "include" });
      const json = (await res.json()) as DangerData & { error?: string };
      if (!res.ok) {
        toastError(json.error ?? "تعذر جلب البيانات");
        return;
      }
      setData(json);
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    // Initial data load — async, so setState happens after await, not in the body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const openModal = (s: Scope) => {
    setScope(s);
    setMode("schedule");
    setConfirmText("");
    setPassword("");
    setFormError("");
  };
  const closeModal = () => {
    if (submitting) return;
    setScope(null);
  };

  const submit = async () => {
    if (!scope) return;
    if (confirmText.trim() !== CONFIRM_WORD) {
      setFormError(`اكتب كلمة «${CONFIRM_WORD}» للتأكيد`);
      return;
    }
    if (!password) {
      setFormError("أدخل كلمة المرور");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/superadmin/bulk-deletion", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, instant: mode === "instant", actionPassword: password }),
      });
      const json = (await res.json()) as { error?: string; instant?: boolean; affectedCount?: number };
      if (!res.ok) {
        setFormError(json.error ?? "تعذر تنفيذ الطلب");
        return;
      }
      if (json.instant) {
        toastSuccess(`تم حذف ${json.affectedCount ?? 0} حساب فوراً (قابل للاستعادة لمدة ${data?.purgeDays ?? 30} يوماً)`);
      } else {
        toastSuccess(`تمت جدولة الحذف — سيُنفّذ بعد ${data?.graceDays ?? 7} أيام ما لم تُلغِه`);
      }
      setScope(null);
      setPassword("");
      setConfirmText("");
      await load();
    } catch {
      setFormError("تعذر الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (pwd: string) => {
    if (!cancelTarget) return;
    const res = await fetch(`/api/admin/superadmin/bulk-deletion/${cancelTarget.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: pwd }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر إلغاء الطلب");
    toastSuccess("تم إلغاء طلب الحذف المجدول");
    setCancelTarget(null);
    await load();
  };

  const pending = data?.requests.filter((r) => r.status === "pending") ?? [];
  const history = data?.requests.filter((r) => r.status !== "pending").slice(0, 8) ?? [];

  const scopeCount = (s: Scope) => data?.counts[s] ?? 0;

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      {/* Intro / warning banner */}
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
        <h2 className="flex items-center gap-2 text-lg font-black text-red-400">
          <span className="text-2xl">⚠️</span> منطقة الخطر — حذف جماعي للحسابات
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-red-200/80">
          هذه الأدوات تحذف حسابات بالجملة. المشرفون العامّون والموظفون وحسابك أنت{" "}
          <b>محميّون دائماً</b> ولن يُحذفوا. الحذف المجدول ينتظر{" "}
          <b>{data?.graceDays ?? 7} أيام</b> ويمكنك إلغاؤه في أي وقت. عند التنفيذ تنتقل
          الحسابات إلى سلة المحذوفات (يمكن استعادتها)، ثم تُحذف نهائياً بعد{" "}
          <b>{data?.purgeDays ?? 30} يوماً</b>.
        </p>
      </div>

      {/* Action buttons */}
      {loading ? (
        <div className="py-10 text-center text-gray-500">جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DangerButton
            title="حذف الكل"
            sub="المتعلمين + المعلمين"
            count={scopeCount("all")}
            onClick={() => openModal("all")}
          />
          <DangerButton
            title="المتعلمين فقط"
            sub="حذف كل الطلاب"
            count={scopeCount("students")}
            onClick={() => openModal("students")}
          />
          <DangerButton
            title="المعلمين فقط"
            sub="حذف كل المدرّسين"
            count={scopeCount("teachers")}
            onClick={() => openModal("teachers")}
          />
        </div>
      )}

      {/* Pending scheduled deletions */}
      {pending.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">طلبات حذف مجدولة ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-200">{SCOPE_LABEL[r.scope]}</p>
                  <p className="mt-0.5 text-xs text-amber-200/60">
                    طلبه {r.requestedByName} · ينفَّذ خلال{" "}
                    <span className="font-mono" dir="ltr">{fmtCountdown(r.executeAt, now)}</span>
                  </p>
                </div>
                <button
                  onClick={() => setCancelTarget(r)}
                  className="shrink-0 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-700"
                >
                  إلغاء الطلب
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">آخر العمليات</h3>
          <div className="overflow-hidden rounded-xl border border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-900/60 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">النطاق</th>
                  <th className="px-3 py-2 text-right font-medium">الحالة</th>
                  <th className="px-3 py-2 text-right font-medium">العدد</th>
                  <th className="px-3 py-2 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-gray-300">{SCOPE_LABEL[r.scope]}</td>
                    <td className="px-3 py-2">
                      {r.status === "executed" ? (
                        <span className="text-red-400">
                          {r.instant ? "حذف فوري" : "نُفِّذ"}
                        </span>
                      ) : (
                        <span className="text-gray-500">أُلغي</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{r.affectedCount ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {fmtDate(r.executedAt ?? r.requestedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create-request modal ── */}
      {scope && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-gray-800" dir="rtl">
            <div className="flex items-center gap-3 rounded-t-2xl border-b border-gray-700 bg-red-950/40 p-5">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-bold text-red-400">حذف: {SCOPE_LABEL[scope]}</h2>
              <button
                onClick={closeModal}
                className="mr-auto text-2xl leading-none text-gray-400 transition-colors hover:text-white"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-gray-300">
                سيتأثّر <b className="text-red-400">{scopeCount(scope)}</b> حساب. الحسابات
                ستصبح قابلة للاستعادة لمدة {data?.purgeDays ?? 30} يوماً قبل الحذف النهائي.
              </p>

              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("schedule")}
                  className={`rounded-xl border px-3 py-2.5 text-right transition-colors ${
                    mode === "schedule"
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-gray-600 bg-gray-900 hover:bg-gray-700/50"
                  }`}
                >
                  <p className="text-sm font-bold text-amber-300">جدولة</p>
                  <p className="text-[11px] text-gray-400">بعد {data?.graceDays ?? 7} أيام (قابل للإلغاء)</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("instant")}
                  disabled={!data?.instantConfigured}
                  className={`rounded-xl border px-3 py-2.5 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    mode === "instant"
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-gray-600 bg-gray-900 hover:bg-gray-700/50"
                  }`}
                >
                  <p className="text-sm font-bold text-red-400">حذف فوري</p>
                  <p className="text-[11px] text-gray-400">
                    {data?.instantConfigured ? "الآن — بكلمة مرور خاصة" : "غير مُفعّل بالخادم"}
                  </p>
                </button>
              </div>

              {/* Typed confirmation */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  اكتب «<b className="text-gray-200">{CONFIRM_WORD}</b>» للتأكيد
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value);
                    if (formError) setFormError("");
                  }}
                  placeholder={CONFIRM_WORD}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  {mode === "instant" ? "كلمة مرور الحذف الفوري (BULK_DELETE_PASSWORD)" : "كلمة مرور المشرف"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError("");
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {formError && <p className="text-xs text-red-400">{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60 ${
                    mode === "instant" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {submitting
                    ? "جارٍ التنفيذ..."
                    : mode === "instant"
                    ? "حذف فوري الآن"
                    : `جدولة الحذف (${data?.graceDays ?? 7} أيام)`}
                </button>
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl bg-gray-700 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-60"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel scheduled request ── */}
      {cancelTarget && (
        <ConfirmActionModal
          title="إلغاء طلب الحذف"
          description={`سيتم إلغاء الحذف المجدول لـ«${SCOPE_LABEL[cancelTarget.scope]}». تبقى الحسابات كما هي.`}
          actionLabel="إلغاء الطلب"
          variant="warning"
          onConfirm={cancelRequest}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

function DangerButton({
  title,
  sub,
  count,
  onClick,
}: {
  title: string;
  sub: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-red-500/30 bg-gray-800 p-5 text-right transition-all hover:border-red-500/60 hover:bg-red-950/30"
    >
      <p className="text-sm font-black text-red-400">{title}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
      <p className="mt-3 text-2xl font-black text-white tabular-nums">{count}</p>
      <p className="text-[11px] text-gray-500">حساب نشط</p>
    </button>
  );
}
