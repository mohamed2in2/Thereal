"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw, Trash2, CheckCircle2, UserX, AlertTriangle } from "lucide-react";

interface ViolationItem {
  id: string;
  createdAt: string | Date;
  type: string;
  details?: string;
  videoId?: string;
  student?: {
    id?: string;
    name?: string;
    phone?: string;
    parentPhone?: string;
  };
}

interface SecurityStats {
  totalCount?: number;
  total?: number;
  todayCount?: number;
  today?: number;
  devToolsCount?: number;
  screenshotCount?: number;
  vpnCount?: number;
}

export function SecuritySection() {
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const params = new URLSearchParams();
        if (filterType) params.set("type", filterType);
        if (search) params.set("search", search);

        const res = await fetch(`/api/admin/security-violations?${params.toString()}`);
        const json = await res.json();
        if (!isMounted) return;
        if (json.success) {
          setViolations(json.violations || []);
          setStats(json.stats || null);
          setError(null);
        } else {
          setError(json.error || "فشل تحميل سجل المخالفات الأمنية");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "خطأ في الاتصال بالخادم";
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => {
      isMounted = false;
    };
  }, [filterType, search]);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/security-violations?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setViolations(json.violations || []);
        setStats(json.stats || null);
        setError(null);
      } else {
        setError(json.error || "فشل تحميل سجل المخالفات الأمنية");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في الاتصال بالخادم";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteViolation = async (id: string) => {
    if (!window.confirm("هل تريد حذف هذا السجل بشكل نهائي؟")) return;
    try {
      const res = await fetch(`/api/admin/security-violations?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setViolations((prev) => prev.filter((v) => v.id !== id));
        setActionSuccess("تم حذف السجل بنجاح");
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        alert(data.error || "تعذر الحذف");
      }
    } catch {
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handlePurgeFalsePositives = async () => {
    if (!window.confirm("سيتم حذف جميع سجلات الإنذار الكاذبة الناتجة عن أبعاد الشاشات (DevTools window threshold) وفقدان التركيز المؤقت. متابعة؟")) return;
    try {
      setIsPurging(true);
      const res = await fetch("/api/admin/security-violations?action=purge-false-positives", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message || "تم تنظيف السجلات الكاذبة بنجاح");
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchViolations();
      } else {
        alert(data.error || "تعذر الحذف");
      }
    } catch {
      alert("حدث خطأ أثناء التنظيف");
    } finally {
      setIsPurging(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع سجلات المخالفات الأمنية بالكامل؟")) return;
    try {
      const res = await fetch("/api/admin/security-violations?action=clear-all", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setViolations([]);
        setActionSuccess("تم إفراغ سجل المخالفات بالكامل");
        setTimeout(() => setActionSuccess(null), 3000);
        await fetchViolations();
      }
    } catch {
      alert("حدث خطأ أثناء المسح");
    }
  };

  const handleBanStudent = async (studentId: string, action: "ban" | "unban") => {
    if (!window.confirm(action === "ban" ? "هل تريد حظر حساب الطالب؟" : "هل تريد إلغاء حظر حساب الطالب؟")) return;
    try {
      const res = await fetch("/api/admin/security-violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        alert(data.error || "تعذر تنفيذ الإجراء");
      }
    } catch {
      alert("خطأ في الاتصال");
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "DEVTOOLS":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30";
      case "SCREENSHOT":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30";
      case "VPN_DETECTED":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30";
      case "TAB_SWITCH":
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-700";
      case "CONTEXT_MENU":
        return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "DEVTOOLS":
        return "🚨 أدوات المطور (DevTools)";
      case "SCREENSHOT":
        return "📸 تصوير الشاشة (Screenshot)";
      case "VPN_DETECTED":
        return "🛡️ استخدام VPN / بروكسي";
      case "TAB_SWITCH":
        return "⏸️ مغادرة تبويب الفيديو";
      case "CONTEXT_MENU":
        return "🖱️ محاولة فحص أو كليك يمين";
      default:
        return type;
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Overview Stats Cards (Smooth White / Pure Dark) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المخالفات</span>
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {(stats?.totalCount ?? stats?.total ?? 0).toLocaleString("ar-EG")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">سجل الرصد التراكمي</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مخالفات اليوم</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {(stats?.todayCount ?? stats?.today ?? 0).toLocaleString("ar-EG")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">خلال الـ 24 ساعة الماضية</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">محاولات DevTools</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              🚨
            </span>
          </div>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {(stats?.devToolsCount ?? 0).toLocaleString("ar-EG")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">محاولات اختراق المتصفح</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">محاولات التصوير (Screenshots)</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              📸
            </span>
          </div>
          <p className="text-3xl font-black text-sky-600 dark:text-sky-400 mt-2 font-mono">
            {(stats?.screenshotCount ?? 0).toLocaleString("ar-EG")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">اعتراض الطباعة والتصوير</p>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800/60 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Control & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:border-slate-400 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
          >
            <option value="">جميع أنواع المخالفات</option>
            <option value="DEVTOOLS">🚨 أدوات المطور (DevTools)</option>
            <option value="SCREENSHOT">📸 تصوير الشاشة (Screenshot)</option>
            <option value="VPN_DETECTED">🛡️ في بي إن (VPN)</option>
            <option value="TAB_SWITCH">⏸️ مغادرة التبويب (Tab Switch)</option>
            <option value="CONTEXT_MENU">🖱️ كليك يمين (Context Menu)</option>
          </select>

          <input
            type="text"
            placeholder="بحث باسم الطالب أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-slate-400 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 w-64"
          />

          <button
            type="button"
            onClick={fetchViolations}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-slate-900 dark:text-white" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>

        {/* Action Buttons: Clean False Positives & Clear All */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePurgeFalsePositives}
            disabled={isPurging}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            title="حذف جميع السجلات التي تم رصدها كإنذار كاذب على التابلت والموبايل"
          >
            <span>🧹</span>
            <span>تنظيف الإنذارات الكاذبة</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="إفراغ سجل المخالفات بالكامل"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح الكل</span>
          </button>
        </div>
      </div>

      {/* Violations Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm dark:bg-slate-900/90 dark:border-slate-800/90">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/90 text-slate-700 border-b border-slate-200 font-bold dark:bg-slate-950/80 dark:text-slate-400 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">التوقيت</th>
                <th className="py-3.5 px-4">الطالب</th>
                <th className="py-3.5 px-4">رقم الهاتف</th>
                <th className="py-3.5 px-4">هاتف ولي الأمر</th>
                <th className="py-3.5 px-4">نوع المخالفة</th>
                <th className="py-3.5 px-4">التفاصيل الفنية</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                      <span>جاري تحميل سجلات المخالفات الأمنية...</span>
                    </div>
                  </td>
                </tr>
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="font-bold text-slate-700 dark:text-slate-300">لا توجد مخالفات أمنية حالياً</p>
                      <p className="text-xs text-slate-400">المنظومة آمنة بالكامل ولم تسجل أية مخالفات مطابقة للبحث</p>
                    </div>
                  </td>
                </tr>
              ) : (
                violations.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono dir-ltr">
                      {new Date(v.createdAt).toLocaleString("ar-EG")}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {v.student?.name || "طالب غير مسجل"}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono dir-ltr text-slate-700 dark:text-slate-300">
                      {v.student?.phone || "—"}
                    </td>

                    <td className="py-3 px-4 font-mono dir-ltr text-sky-600 dark:text-sky-400 font-medium">
                      {v.student?.parentPhone || "غير مسجل"}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${getBadgeStyle(v.type)}`}>
                        {getTypeName(v.type)}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div
                        dir="ltr"
                        className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate"
                        title={v.details || ""}
                      >
                        {v.details || "—"}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {v.student?.id && (
                          <button
                            type="button"
                            onClick={() => handleBanStudent(v.student!.id!, "ban")}
                            title="حظر حساب الطالب"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteViolation(v.id)}
                          title="حذف هذا السجل"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
