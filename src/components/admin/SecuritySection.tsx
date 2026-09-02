"use client";

import { useEffect, useState } from "react";

interface ViolationItem {
  id: string;
  createdAt: string | Date;
  type: string;
  details?: string;
  videoId?: string;
  student?: {
    name?: string;
    phone?: string;
    parentPhone?: string;
  };
}

interface SecurityStats {
  total?: number;
  today?: number;
  byType?: Record<string, number>;
}

export function SecuritySection() {
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchViolations = async () => {
      try {
        const params = new URLSearchParams();
        if (filterType) params.set("type", filterType);
        if (search) params.set("search", search);

        const res = await fetch(`/api/admin/security-violations?${params.toString()}`);
        const json = await res.json();
        if (!isMounted) return;
        if (json.success) {
          setViolations(json.violations || []);
          setStats(json.stats);
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
    void fetchViolations();
    return () => {
      isMounted = false;
    };
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
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
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
        return "🖱️ محاولة نسخ أو فحص عنصر";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">إجمالي المخالفات المسجلة</p>
          <p className="text-2xl font-black text-rose-400 mt-1 font-mono">
            {stats?.total ?? "—"}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">مخالفات اليوم</p>
          <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
            {stats?.today ?? "—"}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">محاولات الـ DevTools</p>
          <p className="text-2xl font-black text-sky-400 mt-1 font-mono">
            {stats?.byType?.DEVTOOLS ?? 0}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600"
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
            placeholder="بحث باسم الطالب أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600 w-56 sm:w-64"
          />
        </div>

        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (filterType) params.set("type", filterType);
            if (search) params.set("search", search);
            fetch(`/api/admin/security-violations?${params.toString()}`)
              .then((r) => r.json())
              .then((json) => {
                if (json.success) {
                  setViolations(json.violations || []);
                  setStats(json.stats);
                }
              });
          }}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          🔄 تحديث فوري
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {error && (
          <div className="p-4 bg-rose-950/40 border-b border-rose-900/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="p-3">التوقيت</th>
                <th className="p-3">الطالب</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3">هاتف ولي الأمر</th>
                <th className="p-3">نوع المخالفة</th>
                <th className="p-3">معرف الفيديو</th>
                <th className="p-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
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
                violations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 whitespace-nowrap text-slate-400 font-mono dir-ltr">
                      {new Date(v.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3 font-bold text-white">{v.student?.name || "طالب"}</td>
                    <td className="p-3 font-mono dir-ltr">{v.student?.phone || "—"}</td>
                    <td className="p-3 font-mono dir-ltr text-sky-400">{v.student?.parentPhone || "غير مسجل"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(v.type)}`}>
                        {getTypeName(v.type)}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[10px]">
                      {v.videoId ? v.videoId.slice(0, 10) + "..." : "—"}
                    </td>
                    <td className="p-3 text-slate-300 max-w-xs truncate" title={v.details || ""}>
                      {v.details || "—"}
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
