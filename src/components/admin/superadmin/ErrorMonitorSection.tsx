"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface ClientError {
  id: string;
  type: string;
  message: string;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  userId: string | null;
  userRole: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  error:             { label: "خطأ",            color: "bg-red-500/15 text-red-400 border-red-500/30",    icon: "🔴" },
  warning:           { label: "تحذير",          color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: "🟡" },
  unhandled_promise: { label: "Promise غير معالج", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: "🟠" },
  api_error:         { label: "خطأ API",        color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: "🟣" },
};

const TYPE_FILTERS = [
  { value: "", label: "الكل" },
  { value: "error", label: "أخطاء" },
  { value: "warning", label: "تحذيرات" },
  { value: "unhandled_promise", label: "Promise" },
  { value: "api_error", label: "API" },
];

const PAGE_SIZE = 50;

function fmtDate(d: string) {
  return new Date(d).toLocaleString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function ErrorMonitorSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [errors, setErrors] = useState<ClientError[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchErrors = useCallback(async (type: string, pageOffset: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset * PAGE_SIZE));
    try {
      const res = await fetch(`/api/admin/superadmin/errors?${params}`, { credentials: "include" });
      const data = (await res.json()) as { errors?: ClientError[]; total?: number };
      setErrors(data.errors ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchErrors(typeFilter, page); };
    void load();
  }, [fetchErrors, typeFilter, page]);

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    setPage(0);
  };

  const handleClearAll = async () => {
    if (!confirm("هل تريد مسح جميع السجلات نهائياً؟ لا يمكن التراجع.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/admin/superadmin/errors", {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { cleared?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "تعذر المسح");
      toastSuccess(`تم مسح ${data.cleared ?? 0} سجل`);
      setErrors([]);
      setTotal(0);
      setPage(0);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">مراقبة الأخطاء والتحذيرات</h2>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? "جارٍ التحميل..." : `${total} سجل`}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => void fetchErrors(typeFilter, page)}
            disabled={loading}
            className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            ↻ تحديث
          </button>
          {total > 0 && (
            <button
              onClick={() => void handleClearAll()}
              disabled={clearing}
              className="px-3 py-2 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {clearing ? "جارٍ المسح..." : "🗑️ مسح الكل"}
            </button>
          )}
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleTypeFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              typeFilter === f.value
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">جارٍ التحميل...</div>
        ) : errors.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-gray-400">لا توجد أخطاء مسجّلة</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-gray-700">
            {errors.map((err) => {
              const meta = TYPE_META[err.type] ?? TYPE_META.error;
              const isExpanded = expandedId === err.id;
              return (
                <div key={err.id} className="p-4">
                  {/* Main row */}
                  <div
                    className="flex items-start gap-3 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : err.id)}
                  >
                    <span className="text-base mt-0.5 shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                        {err.userRole && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                            {err.userRole}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 mr-auto">
                          {fmtDate(err.createdAt)}
                        </span>
                      </div>
                      <p className="text-white text-sm font-mono break-all leading-relaxed">
                        {err.message}
                      </p>
                      {err.url && (
                        <p className="text-gray-500 text-xs mt-1 truncate">{err.url}</p>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs shrink-0 mt-1">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 pl-7">
                      {err.stack && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1 font-semibold">Stack Trace</p>
                          <pre className="text-xs text-gray-300 bg-gray-900/70 rounded-lg p-3 overflow-x-auto border border-gray-700 whitespace-pre-wrap break-all">
                            {err.stack}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {err.userId && (
                          <div>
                            <span className="text-gray-500">User ID: </span>
                            <span className="text-gray-300 font-mono">{err.userId}</span>
                          </div>
                        )}
                        {err.userAgent && (
                          <div className="col-span-2">
                            <span className="text-gray-500">User Agent: </span>
                            <span className="text-gray-400 break-all">{err.userAgent}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            صفحة {page + 1} من {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs rounded-lg"
            >
              السابق
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs rounded-lg"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
