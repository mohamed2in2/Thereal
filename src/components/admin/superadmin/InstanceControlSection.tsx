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

interface FoundStudent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  parentPhone: string | null;
  educationalStage: string | null;
  age: number | null;
  isActive: boolean;
  points: number;
  createdAt: string;
  lastLoginAt: string | null;
  _count?: {
    accessCodes: number;
    courseEnrollments: number;
    quizResults: number;
  };
}

interface ActivityLogItem {
  id: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

interface LiveLogStudent {
  id: string;
  name: string;
  phone: string | null;
  parentPhone: string | null;
  educationalStage: string | null;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
  points: number;
}

const card = "rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 transition-all";
const input =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-slate-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all";

export function InstanceControlSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [actionPassword, setActionPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Student phone search & Impersonation state
  const [studentPhoneSearch, setStudentPhoneSearch] = useState("");
  const [foundStudents, setFoundStudents] = useState<FoundStudent[]>([]);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Real-time Live Activity & Deletions state
  const [liveStudents, setLiveStudents] = useState<LiveLogStudent[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [loadingLiveLogs, setLoadingLiveLogs] = useState(false);
  const [liveTab, setLiveTab] = useState<"students" | "actions">("students");
  const [autoRefreshLive, setAutoRefreshLive] = useState(true);

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

  // ── Student Impersonation / Direct Login (Owner High Security) ──
  const searchStudent = async () => {
    if (!studentPhoneSearch.trim()) {
      toastError("يرجى إدخال رقم هاتف الطالب أولاً");
      return;
    }
    setSearchingStudent(true);
    setFoundStudents([]);
    try {
      const res = await fetch("/api/admin/superadmin/impersonate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", phone: studentPhoneSearch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "لم يتم العثور على طالب");
      setFoundStudents(data.students || []);
      toastSuccess(`تم العثور على ${data.students?.length} حساب`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ أثناء البحث");
    } finally {
      setSearchingStudent(false);
    }
  };

  const loginAsStudent = async (studentId: string, studentName: string) => {
    if (!needPw()) return;
    setImpersonatingId(studentId);
    try {
      const res = await fetch("/api/admin/superadmin/impersonate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "impersonate",
          studentId,
          actionPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر الدخول لحساب الطالب");
      toastSuccess(`جاري الانتقال لحساب الطالب: ${studentName}...`);
      setTimeout(() => {
        window.location.href = data.redirectUrl || "/courses";
      }, 600);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "خطأ أثناء الدخول للحساب");
      setImpersonatingId(null);
    }
  };

  // ── Real-Time Live Activity & Deletions Feed ──
  const fetchLiveLogs = useCallback(async (showToast = false) => {
    setLoadingLiveLogs(true);
    try {
      const res = await fetch("/api/admin/superadmin/live-logs", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setLiveStudents(data.recentStudents || []);
        setActivityLogs(data.activityLogs || []);
        setTotalStudentsCount(data.totalStudents || 0);
        if (showToast) toastSuccess("تم تحديث السجلات المباشرة");
      }
    } catch {
      // quiet poll error
    } finally {
      setLoadingLiveLogs(false);
    }
  }, [toastSuccess]);

  // Initial load & Polling interval
  useEffect(() => {
    let isMounted = true;
    const poll = () => {
      if (isMounted) void fetchLiveLogs();
    };
    const timer = setTimeout(poll, 0);
    const interval = autoRefreshLive ? setInterval(poll, 10000) : null;
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [fetchLiveLogs, autoRefreshLive]);

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

      {/* ── Direct Student Access (Owner High Security) ── */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">الدخول المباشر لحساب طالب (Owner Super-Access)</h3>
              <span className="rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold border border-amber-200 dark:border-amber-800/40">
                خاص بالمالك فقط
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ابحث برقم هاتف أي طالب لمعاينة المنصة بعينيه مباشرة وحل مشكلاته الفنية والتعليمية.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              dir="ltr"
              value={studentPhoneSearch}
              onChange={(e) => setStudentPhoneSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void searchStudent()}
              placeholder="+201113871409 أو 01113871409"
              className={`${input} font-mono text-left pl-3 pr-9`}
            />
            <span className="absolute right-3 top-2.5 text-gray-400 text-sm pointer-events-none">
              📱
            </span>
          </div>
          <button
            type="button"
            onClick={searchStudent}
            disabled={searchingStudent}
            className="w-full sm:w-auto shrink-0 rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-gray-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-amber-500/10"
          >
            {searchingStudent ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                <span>جارٍ البحث...</span>
              </>
            ) : (
              <>
                <span>بحث عن الطالب</span>
                <span>🔍</span>
              </>
            )}
          </button>
        </div>

        {/* Found Students Results */}
        {foundStudents.length > 0 && (
          <div className="mt-4 space-y-3 pt-4 border-t border-gray-700/60">
            <div className="text-xs font-semibold text-gray-300 mb-2">
              نتائج البحث ({foundStudents.length}):
            </div>
            {foundStudents.map((st) => (
              <div
                key={st.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-900/80 border border-gray-700/80 hover:border-amber-500/40 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{st.name}</span>
                    <span className="rounded bg-sky-500/20 text-sky-300 text-[11px] font-semibold px-2 py-0.5 border border-sky-500/30">
                      {st.educationalStage === "sec_1"
                        ? "أولى ثانوي"
                        : st.educationalStage === "sec_2"
                        ? "ثانية ثانوي"
                        : st.educationalStage === "sec_3"
                        ? "ثالثة ثانوي"
                        : st.educationalStage || "غير محدد"}
                    </span>
                    <span
                      className={`rounded text-[10px] font-bold px-1.5 py-0.5 ${
                        st.isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {st.isActive ? "نشط" : "معطل"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-gray-300">📱 {st.phone || "—"}</span>
                    {st.parentPhone && (
                      <span className="font-mono text-gray-400">👨‍👧 ولي الأمر: {st.parentPhone}</span>
                    )}
                    <span className="text-amber-400/90 font-bold">⭐ {st.points} نقطة</span>
                    <span className="text-gray-500 text-[11px]">
                      مسجل في: {st._count?.courseEnrollments || st._count?.accessCodes || 0} كورس
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loginAsStudent(st.id, st.name)}
                  disabled={impersonatingId === st.id}
                  className="w-full sm:w-auto shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  {impersonatingId === st.id ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جارٍ الدخول...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀 الدخول لحساب الطالب</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Real-Time Live Stream & Activity Log ── */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">سجل الأنشطة وتسجيل الطلاب المباشر (Live Stream)</h3>
                <span className="rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 px-2.5 py-0.5 text-[10px] font-bold border border-sky-200 dark:border-sky-800/40">
                  إجمالي الطلاب: {totalStudentsCount}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تتبع لحظي بالوقت والتاريخ لحسابات الطلاب المنشأة وحذف الكورسات والعمليات الحية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setAutoRefreshLive(!autoRefreshLive)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${
                autoRefreshLive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-gray-700/50 text-gray-400 border-gray-600"
              }`}
            >
              <span>{autoRefreshLive ? "🟢 تحديث تلقائي (10ث)" : "⚪ متوقف"}</span>
            </button>
            <button
              type="button"
              onClick={() => void fetchLiveLogs(true)}
              disabled={loadingLiveLogs}
              className="text-xs px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold border border-gray-600 transition-colors flex items-center gap-1"
            >
              <span>{loadingLiveLogs ? "..." : "🔄 تحديث"}</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-700 mb-3 gap-2">
          <button
            type="button"
            onClick={() => setLiveTab("students")}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
              liveTab === "students"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <span>👥 تسجيلات الطلاب الحية</span>
            <span className="rounded-full bg-gray-700 px-1.5 py-0.2 text-[10px] text-gray-300">
              {liveStudents.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLiveTab("actions")}
            className={`pb-2 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
              liveTab === "actions"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <span>🗑️ سجل العمليات وحذف الكورسات</span>
            <span className="rounded-full bg-gray-700 px-1.5 py-0.2 text-[10px] text-gray-300">
              {activityLogs.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Live Students Stream */}
        {liveTab === "students" && (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {liveStudents.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">لا توجد تسجيلات حديثة.</div>
            ) : (
              liveStudents.map((st) => (
                <div
                  key={st.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-gray-900/60 border border-gray-700/50 hover:bg-gray-900 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[11px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                      ⏱️ {new Date(st.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="font-bold text-white">{st.name}</span>
                    <span className="font-mono text-gray-300">{st.phone || st.email}</span>
                    <span className="rounded bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 border border-gray-700">
                      {st.educationalStage === "sec_1"
                        ? "أولى ثانوي"
                        : st.educationalStage === "sec_2"
                        ? "ثانية ثانوي"
                        : st.educationalStage === "sec_3"
                        ? "ثالثة ثانوي"
                        : st.educationalStage || "عام"}
                    </span>
                    <span className="text-gray-500 text-[11px]">
                      📅 {new Date(st.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => loginAsStudent(st.id, st.name)}
                    disabled={impersonatingId === st.id}
                    className="shrink-0 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition-colors flex items-center gap-1"
                  >
                    {impersonatingId === st.id ? "..." : "🚀 دخول كطالب"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Activity & Deletion Log */}
        {liveTab === "actions" && (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {activityLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">لا توجد عمليات مسجلة حديثاً.</div>
            ) : (
              activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-gray-900/60 border border-gray-700/50 hover:bg-gray-900 transition-colors text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        ⏱️ {new Date(log.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          log.action === "COURSE_LIBRARY_REMOVE"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : log.action === "STUDENT_IMPERSONATE"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {log.action === "COURSE_LIBRARY_REMOVE"
                          ? "🗑️ حذف كورس من المكتبة"
                          : log.action === "STUDENT_IMPERSONATE"
                          ? "🔐 دخول إداري كطالب"
                          : log.action}
                      </span>
                      <span className="text-white font-semibold">{log.adminName}</span>
                    </div>
                    <span className="text-gray-500 text-[11px]">
                      📅 {new Date(log.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  <div className="text-gray-300 text-[11px] flex items-center gap-2 flex-wrap pr-1">
                    <span>الهدف: <strong className="text-white">{log.targetName}</strong></span>
                    {log.meta && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {log.meta.studentPhone ? `(هاتف: ${log.meta.studentPhone})` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
