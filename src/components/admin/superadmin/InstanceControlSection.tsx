"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Superadmin {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
}

const card = "rounded-2xl border border-gray-700 bg-gray-800 p-5";
const input =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500";

export function InstanceControlSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [actionPassword, setActionPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [maintOn, setMaintOn] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");

  const [vCounts, setVCounts] = useState({ students: 0, teachers: 0, courses: 0 });
  const [gen, setGen] = useState({ teachers: 3, students: 15, courses: 4 });

  const [admins, setAdmins] = useState<Superadmin[]>([]);
  const [selfId, setSelfId] = useState("");
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });

  const [overloadState, setOverloadState] = useState<{
    mode: "auto" | "on" | "off";
    ramThresholdPct: number;
    cooldownUntil: string | null;
    message: string;
    isTriggered: boolean;
    remainingMinutes: number;
    memory: { usedMemPct: number; usedMemMb: number; totalMemMb: number; processRssMb: number };
  } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [m, v, s, ov] = await Promise.all([
        fetch("/api/admin/superadmin/maintenance", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/superadmin/virtual-data", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/superadmin/superadmins", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/superadmin/overload-protection", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (typeof m?.on === "boolean") {
        setMaintOn(m.on);
        setMaintMsg(m.message ?? "");
      }
      if (v && typeof v.students === "number") setVCounts(v);
      if (Array.isArray(s?.superadmins)) {
        setAdmins(s.superadmins);
        setSelfId(s.selfId ?? "");
      }
      if (ov?.state) {
        setOverloadState(ov.state);
      }
    } catch {
      toastError("تعذر تحميل لوحة التحكم");
    }
  }, [toastError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  const needPw = () => {
    if (!actionPassword) {
      toastError("أدخل كلمة مرور المشرف في الأعلى أولاً");
      return false;
    }
    return true;
  };

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, actionPassword }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "تعذر تنفيذ العملية");
    return json;
  };
  const patch = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, actionPassword }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "تعذر تنفيذ العملية");
    return json;
  };

  // ── Maintenance ──
  const toggleMaintenance = async () => {
    if (!needPw()) return;
    setBusy(true);
    try {
      const next = !maintOn;
      await post("/api/admin/superadmin/maintenance", { on: next, message: maintMsg });
      setMaintOn(next);
      toastSuccess(next ? "تم تفعيل وضع الصيانة" : "تم إيقاف وضع الصيانة");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };
  const saveMessage = async () => {
    if (!needPw()) return;
    setBusy(true);
    try {
      await post("/api/admin/superadmin/maintenance", { message: maintMsg });
      toastSuccess("تم حفظ رسالة الصيانة");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  // ── Overload Protection ──
  const updateOverload = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!needPw()) return;
    setBusy(true);
    try {
      const res = await post("/api/admin/superadmin/overload-protection", { action, ...payload });
      if (res?.state) {
        setOverloadState(res.state);
        toastSuccess("تم تحديث نظام حماية السيرفر الاستباقية");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  // ── Virtual data ──
  const generate = async () => {
    if (!needPw()) return;
    setBusy(true);
    try {
      const r = await post("/api/admin/superadmin/virtual-data", { action: "generate", ...gen });
      toastSuccess(
        `تم إنشاء ${r.created.teachers} مدرس و${r.created.students} طالب و${r.created.courses} كورس`
      );
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };
  const clearVirtual = async () => {
    if (!needPw()) return;
    setBusy(true);
    try {
      const r = await post("/api/admin/superadmin/virtual-data", { action: "clear" });
      toastSuccess(`تم حذف ${r.cleared.users} حساب و${r.cleared.courses} كورس تجريبي`);
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  // ── Superadmins ──
  const renameAdmin = async (id: string, name: string) => {
    if (!needPw()) return;
    try {
      await patch(`/api/admin/superadmin/superadmins/${id}`, { name });
      toastSuccess("تم تحديث الاسم");
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    }
  };
  const changePw = async (id: string, password: string) => {
    if (!needPw()) return;
    try {
      await patch(`/api/admin/superadmin/superadmins/${id}`, { password });
      toastSuccess("تم تغيير كلمة المرور");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    }
  };
  const clearPw = async (id: string, name: string) => {
    if (!needPw()) return;
    if (!window.confirm(`هل تريد حذف كلمة مرور "${name}"؟ لن يتمكن من تسجيل الدخول بكلمة مرور بعد ذلك.`)) return;
    try {
      await patch(`/api/admin/superadmin/superadmins/${id}`, { clearPassword: true });
      toastSuccess("تم حذف كلمة المرور");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    }
  };
  const toggleActive = async (a: Superadmin) => {
    if (!needPw()) return;
    try {
      await patch(`/api/admin/superadmin/superadmins/${a.id}`, { isActive: !a.isActive });
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    }
  };
  const removeAdmin = async (id: string) => {
    if (!needPw()) return;
    try {
      const res = await fetch(`/api/admin/superadmin/superadmins/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "تعذر الحذف");
      toastSuccess("تم حذف المشرف");
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    }
  };
  const createAdmin = async () => {
    if (!needPw()) return;
    setBusy(true);
    try {
      await post("/api/admin/superadmin/superadmins", newAdmin);
      toastSuccess("تم إنشاء مشرف عام جديد");
      setNewAdmin({ name: "", email: "", password: "" });
      await loadAll();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      {/* Shared action password */}
      <div className={card}>
        <label className="mb-1 block text-xs text-gray-400">
          كلمة مرور المشرف (مطلوبة لكل إجراء في هذه الصفحة)
        </label>
        <input
          type="password"
          value={actionPassword}
          onChange={(e) => setActionPassword(e.target.value)}
          placeholder="••••••••"
          className={input}
        />
      </div>

      {/* Maintenance */}
      <div className={card}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">وضع الصيانة</h3>
            <p className="text-xs text-gray-400">
              يُظهر للزوّار صفحة «شيء رائع قادم». المشرفون العامون و /adminpanel يعملون بشكل طبيعي.
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={busy}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              maintOn ? "bg-emerald-500" : "bg-gray-600"
            }`}
            aria-pressed={maintOn}
            aria-label="تبديل وضع الصيانة"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                maintOn ? "left-1" : "right-1"
              }`}
            />
          </button>
        </div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
            maintOn ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700 text-gray-300"
          }`}
        >
          {maintOn ? "الصيانة مُفعّلة الآن" : "الموقع يعمل بشكل طبيعي"}
        </span>
        <textarea
          value={maintMsg}
          onChange={(e) => setMaintMsg(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="رسالة الصيانة المعروضة للزوّار..."
          className={`${input} mt-3 resize-none`}
        />
        <button
          onClick={saveMessage}
          disabled={busy}
          className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          حفظ الرسالة
        </button>
      </div>

      {/* Emergency Overload Protection */}
      <div className={card}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <span>⚡ نظام حماية السيرفر الاستباقية من الانهيار</span>
              {overloadState?.isTriggered && (
                <span className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                  مُفعّل الآن لحماية السيرفر
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              في حالة وصول ضغط الطلاب أو استهلاك الرام إلى الحد الأقصى (100%)، يتم توجيه الطلاب الجدد لغرفة الانتظار تلقائياً لمدة 15 دقيقة لمنع انهيار السيرفر. <b className="text-sky-400">/adminpanel يعمل دائماً بدون توقف للمشرفين.</b>
            </p>
          </div>
        </div>

        {/* Live RAM Gauge */}
        {overloadState?.memory && (
          <div className="mb-4 rounded-xl border border-gray-700 bg-gray-900/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">استهلاك الرام الفعلي للسيرفر:</span>
              <span className="font-mono font-bold text-white">
                {overloadState.memory.usedMemPct}% ({overloadState.memory.usedMemMb} MB / {overloadState.memory.totalMemMb} MB)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overloadState.memory.usedMemPct > 80
                    ? "bg-red-500"
                    : overloadState.memory.usedMemPct > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, overloadState.memory.usedMemPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-gray-300">وضع الحماية المطلوبة:</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "auto", label: "ذكي (Auto 85% RAM)" },
              { id: "on", label: "تفعيل إجباري (Manual ON)" },
              { id: "off", label: "إيقاف الحماية (OFF)" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => updateOverload("setMode", { mode: m.id })}
                disabled={busy}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  overloadState?.mode === m.id
                    ? "bg-sky-600 text-white shadow-md"
                    : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Cooldown Buffer Timers */}
        <div className="mb-4 rounded-xl border border-gray-700/60 bg-gray-900/40 p-3">
          <label className="mb-2 block text-xs font-semibold text-gray-300">
            التحكم في وقت التهداة المؤقتة للطلاب (Cooldown Buffer):
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => updateOverload("addCooldown", { addMinutes: 15 })}
              disabled={busy}
              className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
            >
              ⏱️ إعطاء مهلة +15 دقيقة
            </button>
            <button
              onClick={() => updateOverload("addCooldown", { addMinutes: 30 })}
              disabled={busy}
              className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
            >
              ⏱️ إعطاء مهلة +30 دقيقة
            </button>
            <button
              onClick={() => updateOverload("resetCooldown")}
              disabled={busy}
              className="rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/30"
            >
              🛑 إلغاء وقت الانتظار فوراً
            </button>
          </div>
          {overloadState?.remainingMinutes ? (
            <p className="mt-2 text-[11px] text-amber-400 font-semibold">
              متبقى على انتهاء فترة تنظيم المرور: {overloadState.remainingMinutes} دقيقة
            </p>
          ) : null}
        </div>

        {/* Custom Message */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-300">
            الرسالة المعروضة للطلاب في غرفة الانتظار:
          </label>
          <textarea
            value={overloadState?.message || ""}
            onChange={(e) =>
              setOverloadState((prev) => (prev ? { ...prev, message: e.target.value } : null))
            }
            rows={2}
            maxLength={300}
            className={`${input} resize-none`}
          />
          <button
            onClick={() => updateOverload("setMessage", { message: overloadState?.message })}
            disabled={busy}
            className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            حفظ رسالة الانتظار
          </button>
        </div>
      </div>

      {/* Virtual data */}
      <div className={card}>
        <h3 className="font-bold text-white">البيانات التجريبية</h3>
        <p className="text-xs text-gray-400">
          إنشاء طلاب ومدرسين وكورسات وهمية بفيديوهات يوتيوب للعرض والتجربة. الحالي:{" "}
          <b className="text-gray-200">
            {vCounts.students} طالب · {vCounts.teachers} مدرس · {vCounts.courses} كورس
          </b>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["teachers", "students", "courses"] as const).map((k) => (
            <div key={k}>
              <label className="mb-1 block text-[11px] text-gray-400">
                {k === "teachers" ? "مدرسون" : k === "students" ? "طلاب" : "كورسات"}
              </label>
              <input
                type="number"
                min={1}
                value={gen[k]}
                onChange={(e) => setGen({ ...gen, [k]: Math.max(1, parseInt(e.target.value) || 1) })}
                className={input}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            توليد بيانات تجريبية
          </button>
          <button
            onClick={clearVirtual}
            disabled={busy}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            حذف كل البيانات التجريبية
          </button>
        </div>
      </div>

      {/* Superadmins management */}
      <div className={card}>
        <h3 className="mb-3 font-bold text-white">إدارة المشرفين العامين</h3>
        <div className="space-y-2">
          {admins.map((a) => (
            <SuperadminRow
              key={a.id}
              admin={a}
              isSelf={a.id === selfId}
              onRename={renameAdmin}
              onChangePw={changePw}
              onClearPw={clearPw}
              onToggleActive={toggleActive}
              onRemove={removeAdmin}
            />
          ))}
        </div>

        {/* Create */}
        <div className="mt-4 border-t border-gray-700 pt-4">
          <p className="mb-2 text-xs font-semibold text-gray-300">إضافة مشرف عام</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              placeholder="الاسم"
              className={input}
            />
            <input
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              placeholder="البريد الإلكتروني"
              className={input}
            />
            <input
              type="password"
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              placeholder="كلمة المرور"
              className={input}
            />
          </div>
          <button
            onClick={createAdmin}
            disabled={busy}
            className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            إنشاء
          </button>
        </div>
      </div>
    </div>
  );
}

function SuperadminRow({
  admin,
  isSelf,
  onRename,
  onChangePw,
  onClearPw,
  onToggleActive,
  onRemove,
}: {
  admin: Superadmin;
  isSelf: boolean;
  onRename: (id: string, name: string) => void;
  onChangePw: (id: string, password: string) => void;
  onClearPw: (id: string, name: string) => void;
  onToggleActive: (a: Superadmin) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState(admin.name);
  const [pw, setPw] = useState("");

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold text-white">{admin.email}</span>
        {admin.isOwner && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            المالك
          </span>
        )}
        {!admin.isActive && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
            موقوف
          </span>
        )}
        {isSelf && <span className="text-[10px] text-gray-500">(أنت)</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="mb-1 block text-[10px] text-gray-500">الاسم</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => onRename(admin.id, name)}
          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600"
        >
          حفظ الاسم
        </button>
        <div className="flex-1 min-w-[120px]">
          <label className="mb-1 block text-[10px] text-gray-500">كلمة مرور جديدة</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••"
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => {
            if (pw) {
              onChangePw(admin.id, pw);
              setPw("");
            }
          }}
          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600"
        >
          تغيير كلمة المرور
        </button>
        {!admin.isOwner && (
          <button
            onClick={() => onClearPw(admin.id, admin.name)}
            title="حذف كلمة المرور (يمنع تسجيل الدخول بكلمة مرور)"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/25"
          >
            🗑 حذف كلمة المرور
          </button>
        )}
        {!admin.isOwner && (
          <>
            <button
              onClick={() => onToggleActive(admin)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
            >
              {admin.isActive ? "إيقاف" : "تفعيل"}
            </button>
            {!isSelf && (
              <button
                onClick={() => onRemove(admin.id)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
              >
                حذف
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
