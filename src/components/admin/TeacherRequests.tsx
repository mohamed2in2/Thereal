"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";

interface VideoViewRequest {
  id: string;
  status: string;
  reason: string | null;
  grantedViews: number;
  teacherNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  student: { id: string; name: string; phone: string | null };
  video: {
    id: string;
    title: string;
    maxWatchesPerUser: number;
    folder: { name: string; course: { id: string; title: string } };
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};

export function TeacherRequests() {
  const { success, error } = useToast();
  const [viewRequests, setViewRequests] = useState<VideoViewRequest[]>([]);
  const [viewFilter, setViewFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedViewReq, setSelectedViewReq] = useState<VideoViewRequest | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionGrantedViews, setActionGrantedViews] = useState<number>(2);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/view-requests?status=all");
      if (res.ok) {
        const data = await res.json();
        setViewRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Error loading view requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchRequests = async () => {
      try {
        const res = await fetch("/api/admin/view-requests?status=all");
        if (res.ok && active) {
          const data = await res.json();
          setViewRequests(data.requests || []);
        }
      } catch (err) {
        console.error("Error loading view requests:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchRequests();
    return () => {
      active = false;
    };
  }, []);

  const handleViewAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/view-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: id,
          action,
          grantedViews: action === "approve" ? actionGrantedViews : undefined,
          teacherNotes: actionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشلت العملية");
        return;
      }
      success(action === "approve" ? `تمت الموافقة ومنح ${data.grantedViews} مشاهدة إضافية` : "تم رفض الطلب");
      setSelectedViewReq(null);
      setActionNotes("");
      setActionGrantedViews(2);
      load();
    } catch {
      error("حدث خطأ أثناء حفظ القرار");
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = useMemo(() => viewRequests.filter((r) => r.status === "pending").length, [viewRequests]);
  const approvedCount = useMemo(() => viewRequests.filter((r) => r.status === "approved").length, [viewRequests]);
  const rejectedCount = useMemo(() => viewRequests.filter((r) => r.status === "rejected").length, [viewRequests]);

  const filteredViewRequests = useMemo(() => {
    return viewRequests.filter((r) => {
      if (viewFilter !== "all" && r.status !== viewFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        r.student?.name?.toLowerCase().includes(q) ||
        r.student?.phone?.includes(q) ||
        r.video?.title?.toLowerCase().includes(q) ||
        r.video?.folder?.course?.title?.toLowerCase().includes(q) ||
        r.video?.folder?.name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    });
  }, [viewRequests, viewFilter, searchQuery]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Executive Header Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-lg shadow-xs">
                👁️
              </span>
              <div>
                <h2 className="font-black text-lg text-slate-900 dark:text-white">
                  طلبات زيادة المشاهدات
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  مراجعة واعتماد طلبات الطلاب لتمديد عدد مرات مشاهدة المحاضرات والدروس.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto shadow-xs"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span>
            <span>{loading ? "جارٍ التحديث..." : "تحديث الطلبات"}</span>
          </button>
        </div>

        {/* 4 Summary Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">إجمالي الطلبات</span>
            <span className="font-mono text-base font-black text-slate-900 dark:text-white">{viewRequests.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">قيد الانتظار</span>
            <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">المقبولة</span>
            <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">المرفوضة</span>
            <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/90 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
        {/* Status Filter Chips */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            type="button"
            onClick={() => setViewFilter("pending")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === "pending"
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>⏳ قيد الانتظار</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">{pendingCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("approved")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === "approved"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>✓ المقبولة</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">{approvedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("rejected")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === "rejected"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>✗ المرفوضة</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">{rejectedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === "all"
                ? "bg-slate-900 text-white dark:bg-slate-700 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span>الكل</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-mono">{viewRequests.length}</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالطالب، الهاتف، أو الدرس..."
            className="w-full px-3.5 py-1.5 pl-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute left-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Requests Content Feed */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-xs font-bold">جارٍ تحميل طلبات المشاهدات...</span>
        </div>
      ) : filteredViewRequests.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-16 text-center text-slate-500 dark:text-slate-400 dark:border-slate-800/90 dark:bg-slate-900/90 space-y-2">
          <div className="text-4xl">👁️</div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {searchQuery ? "لم يتم العثور على طلبات مطابقة للبحث" : "لا توجد طلبات زيادة مشاهدات في هذا القسم"}
          </p>
          <p className="text-xs text-slate-400">
            تظهر هنا طلبات الطلاب الذين استنفدوا عدد المشاهدات المسموح بها ويرغبون في مشاهدات إضافية.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredViewRequests.map((r) => (
            <div
              key={r.id}
              className="rounded-3xl border border-slate-200/90 bg-white p-5 space-y-4 hover:border-emerald-500/50 transition-all shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{r.student.name}</span>
                    {r.student.phone && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-800" dir="ltr">
                        {r.student.phone}
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 text-[11px] rounded-full font-bold border ${
                        r.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : r.status === "rejected"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>الكورس:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{r.video.folder.course.title}</strong>
                    <span>• المحاضرة:</span>
                    <strong className="text-slate-700 dark:text-slate-300">{r.video.folder.name}</strong>
                    <span>• الدرس:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{r.video.title}</strong>
                    <span>(الحد الأساسي: {r.video.maxWatchesPerUser} مشاهدات)</span>
                  </p>
                </div>

                <div className="text-left text-xs text-slate-400 shrink-0">
                  <p>{new Date(r.createdAt).toLocaleString("ar-EG")}</p>
                  {r.status === "approved" && (
                    <p className="text-emerald-500 font-bold mt-0.5 font-mono">
                      +{r.grantedViews} مشاهدة ممنوحة
                    </p>
                  )}
                </div>
              </div>

              {r.reason && (
                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800/80 text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400 ml-1">سبب طلب الطالب:</span>
                  <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{r.reason}</span>
                </div>
              )}

              {r.teacherNotes && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 ml-1">رد / ملاحظة المعلم:</span>
                  <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{r.teacherNotes}</span>
                </div>
              )}

              {r.status === "pending" && (
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedViewReq(r);
                      setActionGrantedViews(2);
                      setActionNotes("");
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <span>👁️</span>
                    <span>مراجعة ومنح مشاهدات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewAction(r.id, "reject")}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    رفض الطلب
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review & Grant Views Modal */}
      {selectedViewReq && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>👁️</span>
                <span>منح مشاهدات إضافية للطالب</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                الطالب: <strong className="text-slate-800 dark:text-slate-200">{selectedViewReq.student.name}</strong> • الدرس: {selectedViewReq.video.title}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                عدد المشاهدات الإضافية المطلوب منحها:
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActionGrantedViews(v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      actionGrantedViews === v
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ملاحظة للطالب (اختياري):
              </label>
              <input
                type="text"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="مثال: تم منحك محاولتين إضافيتين بناءً على طلبك"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleViewAction(selectedViewReq.id, "approve")}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "جارٍ الحفظ..." : "✓ موافقة ومنح المشاهدات"}
              </button>
              <button
                type="button"
                onClick={() => handleViewAction(selectedViewReq.id, "reject")}
                disabled={actionLoading}
                className="px-4 py-2.5 border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                رفض
              </button>
              <button
                type="button"
                onClick={() => setSelectedViewReq(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
