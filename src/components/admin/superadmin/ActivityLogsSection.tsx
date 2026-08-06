"use client";
import { useState, useCallback } from "react";

interface LogEntry {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  metadata: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  SUSPEND_STUDENT: "تعليق طالب",
  UNSUSPEND_STUDENT: "رفع تعليق طالب",
  SOFT_DELETE_STUDENT: "أرشفة طالب",
  RESTORE_STUDENT: "استعادة طالب",
  HARD_DELETE_STUDENT: "حذف نهائي لطالب",
  EDIT_TEACHER_NAME: "تعديل اسم مدرس",
  DELETE_TEACHER: "حذف مدرس",
  RESET_TEACHER_PASSWORD: "إعادة تعيين كلمة مرور مدرس",
  CREATE_TEACHER: "إنشاء حساب مدرس",
};

const ACTION_COLORS: Record<string, string> = {
  SUSPEND_STUDENT: "text-yellow-400 bg-yellow-500/10",
  UNSUSPEND_STUDENT: "text-green-400 bg-green-500/10",
  SOFT_DELETE_STUDENT: "text-orange-400 bg-orange-500/10",
  RESTORE_STUDENT: "text-blue-400 bg-blue-500/10",
  HARD_DELETE_STUDENT: "text-red-400 bg-red-500/10",
  EDIT_TEACHER_NAME: "text-purple-400 bg-purple-500/10",
  DELETE_TEACHER: "text-red-400 bg-red-500/10",
  RESET_TEACHER_PASSWORD: "text-yellow-400 bg-yellow-500/10",
  CREATE_TEACHER: "text-green-400 bg-green-500/10",
};

const PAGE_SIZE = 20;

function fmtDate(d: string) {
  return new Date(d).toLocaleString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ActivityLogsSection() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchLogs = useCallback(async (action: string, from: string, to: string, pageOffset: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset * PAGE_SIZE));

    try {
      const res = await fetch(`/api/admin/superadmin/logs?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { logs?: LogEntry[]; total?: number };
      if (res.ok) {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setSearched(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    void fetchLogs(filterAction, filterFrom, filterTo, 0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchLogs(filterAction, filterFrom, filterTo, newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Filters */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-4"
      >
        <h3 className="text-white font-bold mb-4">سجلات النشاط</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-44">
            <label className="block text-xs text-gray-400 mb-1">نوع الإجراء</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">الكل</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "جارٍ البحث..." : "عرض السجلات"}
          </button>
        </div>
      </form>

      {/* Results */}
      {searched && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {total === 0 ? "لا توجد سجلات" : `${total} سجل`}
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>لا توجد سجلات تطابق الفلتر</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-500 text-xs">
                      <th className="text-right px-4 py-3 font-medium">الوقت</th>
                      <th className="text-right px-4 py-3 font-medium">المشرف</th>
                      <th className="text-right px-4 py-3 font-medium">الإجراء</th>
                      <th className="text-right px-4 py-3 font-medium">الهدف</th>
                      <th className="text-right px-4 py-3 font-medium">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                    {logs.map((log) => {
                      const meta = log.metadata
                        ? (() => { try { return JSON.parse(log.metadata) as Record<string, unknown>; } catch { return null; } })()
                        : null;
                      return (
                        <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                            {fmtDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white text-xs font-medium">{log.adminName}</p>
                            <p className="text-gray-500 text-xs font-mono">{log.adminId.slice(0, 8)}…</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                ACTION_COLORS[log.action] ?? "text-gray-400 bg-gray-700"
                              }`}
                            >
                              {ACTION_LABELS[log.action] ?? log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white text-xs">{log.targetName}</p>
                            <p className="text-gray-500 text-xs">{log.targetType}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-48 truncate">
                            {meta
                              ? Object.entries(meta)
                                  .map(([k, v]) => `${k}: ${String(v)}`)
                                  .join(" · ")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    صفحة {page + 1} من {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-xs bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      السابق
                    </button>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 text-xs bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-10 text-center text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p>اضغط &quot;عرض السجلات&quot; لتحميل سجلات النشاط</p>
        </div>
      )}
    </div>
  );
}
