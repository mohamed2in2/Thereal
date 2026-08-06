"use client";

import { useEffect, useState } from "react";

export function SecuritySection() {
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        setStats(json.stats);
        setError(null);
      } else {
        setError(json.error || "فشل تحميل سجل المخالفات الأمنية");
      }
    } catch (err: any) {
      setError(err?.message || "خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, [filterType, search]);

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "DEVTOOLS":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "SCREENSHOT":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "VPN_DETECTED":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "TAB_SWITCH":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "DEVTOOLS":
        return "🚨 أدوات المطور (DevTools)";
      case "SCREENSHOT":
        return "📸 تصوير/طباعة الشاشة";
      case "VPN_DETECTED":
        return "🛡️ استخدام VPN / بروكسي";
      case "TAB_SWITCH":
        return "⏸️ مغادرة تبويب الفيديو";
      case "CONTEXT_MENU":
        return "🖱️ كليك أيمن (Context Menu)";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🚨 مركز المراقبة والرصد الأمني (Anti-Piracy Shield)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة حية لمحاولات تصوير الشاشة، فتح أدوات المطور، استخدام الـ VPN، وإرسال تنبيهات الواتساب التلقائية لأولياء الأمور.
          </p>
        </div>

        <button
          onClick={fetchViolations}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
        >
          🔄 تحديث البيانات
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400">إجمالي المخالفات المسجلة</p>
          <p className="text-2xl font-black text-white mt-1 font-mono">{stats?.totalCount || 0}</p>
        </div>
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-rose-400">محاولات DevTools</p>
          <p className="text-2xl font-black text-rose-400 mt-1 font-mono">{stats?.devToolsCount || 0}</p>
        </div>
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-amber-400">محاولات تصوير الشاشة</p>
          <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{stats?.screenshotCount || 0}</p>
        </div>
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-sky-400">رصد VPN / بروكسي</p>
          <p className="text-2xl font-black text-sky-400 mt-1 font-mono">{stats?.vpnCount || 0}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الطالب، رقم الهاتف، أو الـ IP..."
            className="w-full sm:w-72 bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs outline-none focus:border-rose-500"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-60 bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs outline-none focus:border-rose-500"
          >
            <option value="">جميع أنواع المخالفات</option>
            <option value="DEVTOOLS">🚨 أدوات المطور (DevTools)</option>
            <option value="SCREENSHOT">📸 تصوير/طباعة الشاشة</option>
            <option value="VPN_DETECTED">🛡️ استخدام VPN / بروكسي</option>
            <option value="TAB_SWITCH">⏸️ مغادرة التبويب</option>
            <option value="CONTEXT_MENU">🖱️ كليك أيمن</option>
          </select>
        </div>

        {/* Violations Table */}
        <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">الوقت</th>
                <th className="p-3">اسم الطالب</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3">هاتف ولي الأمر</th>
                <th className="p-3">نوع المخالفة</th>
                <th className="p-3">التفاصيل</th>
                <th className="p-3">عنوان IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && violations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    جاري تحميل سجلات المخالفات...
                  </td>
                </tr>
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    لا توجد مخالفات أمنية مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                violations.map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 whitespace-nowrap text-slate-400 font-mono dir-ltr">
                      {new Date(v.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3 font-bold text-white">{v.student?.name || "طالب"}</td>
                    <td className="p-3 font-mono dir-ltr">{v.student?.phone || "—"}</td>
                    <td className="p-3 font-mono dir-ltr text-sky-400">{v.student?.parentPhone || "غير مسجل"}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getBadgeStyle(v.type)}`}>
                        {getTypeName(v.type)}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-slate-400">{v.details || "محاولة غير مصرح بها"}</td>
                    <td className="p-3 font-mono text-slate-400 dir-ltr">{v.ip || "127.0.0.1"}</td>
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
