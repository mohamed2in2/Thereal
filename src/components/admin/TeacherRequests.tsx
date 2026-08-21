"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface GradeRequest {
  id: string;
  studentId: string;
  quizId: string;
  courseId: string;
  requestedBy: string;
  currentScore: number;
  requestedScore: number | null;
  reason: string;
  aiAnalysis: string | null;
  evidence: string | null;
  status: string;
  teacherNotes: string | null;
  createdAt: string;
  quiz: { title: string };
  course: { title: string };
  student: { name: string; email: string; phone: string | null };
}

interface SupportTicket {
  id: string;
  studentId: string;
  courseId: string | null;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  aiHandled: boolean;
  aiResponse: string | null;
  resolution: string | null;
  createdAt: string;
  student: { name: string; phone: string | null };
  course: { title: string } | null;
}

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

const PRIORITY_BADGES: Record<string, string> = {
  urgent: "bg-red-600/20 text-red-400 border-red-600/40",
  high: "bg-orange-600/20 text-orange-400 border-orange-600/40",
  normal: "bg-blue-600/20 text-blue-400 border-blue-600/40",
  low: "bg-gray-600/20 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-600/40",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  ai_reviewed: "راجعها AI",
  approved: "مقبول",
  rejected: "مرفوض",
  open: "مفتوح",
  ai_handling: "AI يعالجها",
  escalated: "محول للمعلم",
  resolved: "محلول",
  closed: "مغلق",
};

export function TeacherRequests() {
  const { success, error } = useToast();
  const [tab, setTab] = useState<"grades" | "views" | "tickets">("views");
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);
  const [viewRequests, setViewRequests] = useState<VideoViewRequest[]>([]);
  const [viewFilter, setViewFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReq, setSelectedReq] = useState<GradeRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [selectedViewReq, setSelectedViewReq] = useState<VideoViewRequest | null>(null);

  const [actionScore, setActionScore] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionGrantedViews, setActionGrantedViews] = useState<number>(2);
  const [resolution, setResolution] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, t, v] = await Promise.all([
        fetch("/api/grade-requests").then((r) => r.json()),
        fetch("/api/tickets").then((r) => r.json()),
        fetch("/api/admin/view-requests?status=all").then((r) => r.json()),
      ]);
      setGradeRequests(g.requests || []);
      setTickets(t.tickets || []);
      setViewRequests(v.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGradeAction = async (id: string, action: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/grade-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          teacherNotes: actionNotes,
          newScore: action === "approve" && actionScore ? parseFloat(actionScore) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشل");
        return;
      }
      success(data.message);
      setSelectedReq(null);
      setActionScore("");
      setActionNotes("");
      load();
    } catch {
      error("حدث خطأ");
    }
  };

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

  const handleTicketResolve = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });
      const data = await res.json();
      if (!res.ok) {
        error(data.error || "فشل");
        return;
      }
      success(data.message);
      setSelectedTicket(null);
      setResolution("");
      load();
    } catch {
      error("حدث خطأ");
    }
  };

  const pendingGrades = gradeRequests.filter((r) => r.status === "pending" || r.status === "ai_reviewed");
  const pendingViews = viewRequests.filter((r) => r.status === "pending");
  const filteredViewRequests = viewRequests.filter((r) => {
    if (viewFilter === "all") return true;
    return r.status === viewFilter;
  });
  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Tabs Header */}
      <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-[var(--border)] w-fit">
        <button
          onClick={() => setTab("views")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            tab === "views"
              ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
              : "text-slate-600 dark:text-gray-400 hover:text-[var(--ink)]"
          }`}
        >
          <span>👁️ طلبات تمديد المشاهدات</span>
          {pendingViews.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-mono font-bold">
              {pendingViews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("grades")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            tab === "grades"
              ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
              : "text-slate-600 dark:text-gray-400 hover:text-[var(--ink)]"
          }`}
        >
          <span>🎯 طلبات تعديل الدرجات</span>
          {pendingGrades.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-mono font-bold">
              {pendingGrades.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("tickets")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            tab === "tickets"
              ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
              : "text-slate-600 dark:text-gray-400 hover:text-[var(--ink)]"
          }`}
        >
          <span>🎫 تذاكر الدعم</span>
          {openTickets.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-mono font-bold">
              {openTickets.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          <span className="text-sm font-medium">جارٍ تحميل الطلبات...</span>
        </div>
      ) : tab === "views" ? (
        <div className="space-y-4">
          {/* Subfilter chips for view requests */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-gray-800/50 p-3 rounded-2xl border border-[var(--border)]">
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setViewFilter("pending")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  viewFilter === "pending"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                قيد الانتظار ({pendingViews.length})
              </button>
              <button
                onClick={() => setViewFilter("approved")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  viewFilter === "approved"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                المقبولة ({viewRequests.filter((r) => r.status === "approved").length})
              </button>
              <button
                onClick={() => setViewFilter("rejected")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  viewFilter === "rejected"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                المرفوضة ({viewRequests.filter((r) => r.status === "rejected").length})
              </button>
              <button
                onClick={() => setViewFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  viewFilter === "all"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                الكل ({viewRequests.length})
              </button>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              الحد الأساسي للمشاهدات يُضبط في إعدادات الدرس؛ الموافقة تمنح مشاهدات إضافية للطالب المحدد فقط.
            </p>
          </div>

          {filteredViewRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-12 text-center text-slate-500 dark:text-gray-400 border border-[var(--border)] space-y-2">
              <div className="text-3xl">👁️</div>
              <p className="font-bold text-slate-800 dark:text-slate-200">لا توجد طلبات تمديد مشاهدات في هذا القسم</p>
              <p className="text-xs text-slate-500">تظهر هنا طلبات الطلاب الذين استنفدوا مرات المشاهدة ويرغبون في مشاهدات إضافية.</p>
            </div>
          ) : (
            filteredViewRequests.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-800/80 rounded-2xl border border-[var(--border)] p-5 space-y-4 hover:border-sky-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-base">{r.student.name}</span>
                      {r.student.phone && (
                        <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-gray-900 px-2 py-0.5 rounded-md" dir="ltr">
                          {r.student.phone}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 text-xs rounded-full font-bold border ${
                          r.status === "approved"
                            ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                            : r.status === "rejected"
                            ? "bg-red-600/20 text-red-400 border-red-600/40"
                            : "bg-amber-600/20 text-amber-400 border-amber-600/40 animate-pulse"
                        }`}
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      الكورس: <span className="text-sky-400 font-medium">{r.video.folder.course.title}</span> • المجلد:{" "}
                      <span className="text-slate-300 font-medium">{r.video.folder.name}</span> • الدرس:{" "}
                      <span className="text-white font-bold">{r.video.title}</span> • الحد الأساسي:{" "}
                      <span className="font-mono">{r.video.maxWatchesPerUser} مشاهدات</span>
                    </p>
                  </div>

                  <div className="text-left text-xs text-slate-500 shrink-0">
                    <p>{new Date(r.createdAt).toLocaleString("ar-EG")}</p>
                    {r.status === "approved" && (
                      <p className="text-emerald-400 font-bold mt-0.5">
                        +{r.grantedViews} مشاهدة إضافية ممنوحة
                      </p>
                    )}
                  </div>
                </div>

                {r.reason && (
                  <div className="bg-slate-50 dark:bg-gray-900/60 rounded-xl p-3 border border-slate-200 dark:border-gray-700/50">
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mb-1 font-semibold">سبب طلب الطالب:</p>
                    <p className="text-sm text-slate-800 dark:text-gray-200 leading-relaxed">{r.reason}</p>
                  </div>
                )}

                {r.teacherNotes && (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
                    <p className="text-[11px] text-blue-300 mb-1 font-semibold">ملاحظات المعلم:</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{r.teacherNotes}</p>
                  </div>
                )}

                {r.status === "pending" && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => {
                        setSelectedViewReq(r);
                        setActionGrantedViews(2);
                        setActionNotes("");
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-sky-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>👁️</span>
                      <span>مراجعة ومنح مشاهدات</span>
                    </button>
                    <button
                      onClick={() => handleViewAction(r.id, "reject")}
                      disabled={actionLoading}
                      className="px-3.5 py-2 border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      رفض سريع
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : tab === "grades" ? (
        <div className="space-y-3">
          {gradeRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
              لا توجد طلبات تعديل درجات
            </div>
          ) : (
            gradeRequests.map((r) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 dark:text-white">{r.student.name}</span>
                      {r.requestedBy === "ai" && (
                        <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 text-xs rounded-full border border-purple-600/30">
                          🤖 من المرشد الذكي
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${
                        r.status === "approved" ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                        : r.status === "rejected" ? "bg-red-600/20 text-red-400 border-red-600/40"
                        : r.status === "ai_reviewed" ? "bg-purple-600/20 text-purple-300 border-purple-600/30"
                        : "bg-yellow-600/20 text-yellow-400 border-yellow-600/40"
                      }`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {r.course.title} · {r.quiz.title} · {new Date(r.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-500 dark:text-gray-400">الدرجة الحالية: <span className="text-slate-900 dark:text-white font-bold">{r.currentScore}</span></span>
                    {r.requestedScore !== null && (
                      <span className="text-slate-500 dark:text-gray-400">المطلوبة: <span className="text-emerald-400 font-bold">{r.requestedScore}</span></span>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900/60 rounded-xl p-3 mb-3">
                  <p className="text-xs text-slate-500 dark:text-gray-500 mb-1">السبب:</p>
                  <p className="text-sm text-gray-200">{r.reason}</p>
                </div>

                {r.aiAnalysis && (
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-3 mb-3">
                    <p className="text-xs text-purple-300 mb-1">🤖 تحليل المرشد الذكي:</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{r.aiAnalysis}</p>
                  </div>
                )}

                {r.teacherNotes && (
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 mb-3">
                    <p className="text-xs text-blue-300 mb-1">ملاحظاتك:</p>
                    <p className="text-sm text-gray-200">{r.teacherNotes}</p>
                  </div>
                )}

                {(r.status === "pending" || r.status === "ai_reviewed") && (
                  <button
                    onClick={() => {
                      setSelectedReq(r);
                      setActionScore(r.requestedScore?.toString() || r.currentScore.toString());
                      setActionNotes("");
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-bold cursor-pointer"
                  >
                    مراجعة الطلب
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
              لا توجد تذاكر دعم
            </div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">{t.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${PRIORITY_BADGES[t.priority]}`}>
                        {t.priority}
                      </span>
                      {t.aiHandled && (
                        <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 text-xs rounded-full border border-purple-600/30">
                          🤖 AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {t.student.name}
                      {t.course && ` · ${t.course.title}`}
                      {" · "}
                      {new Date(t.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-300">
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>

                <p className="text-sm text-gray-200 mb-3 whitespace-pre-wrap">{t.description}</p>

                {t.aiResponse && (
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-3 mb-3">
                    <p className="text-xs text-purple-300 mb-1">🤖 رد المرشد الذكي:</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{t.aiResponse}</p>
                  </div>
                )}

                {t.resolution && (
                  <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 mb-3">
                    <p className="text-xs text-emerald-300 mb-1">الحل:</p>
                    <p className="text-sm text-gray-200">{t.resolution}</p>
                  </div>
                )}

                {t.status !== "resolved" && t.status !== "closed" && (
                  <button
                    onClick={() => { setSelectedTicket(t); setResolution(""); }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-bold cursor-pointer"
                  >
                    حل التذكرة
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Video View Request Modal */}
      {selectedViewReq && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">مراجعة طلب تمديد مشاهدات</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedViewReq.student.name} • {selectedViewReq.video.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedViewReq(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedViewReq.reason && (
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                <p className="text-xs font-semibold text-slate-400">سبب الطلب المكتوب من الطالب:</p>
                <p className="text-sm text-slate-200 leading-relaxed">{selectedViewReq.reason}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                عدد المشاهدات الإضافية الممنوحة (1 - 20):
              </label>
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setActionGrantedViews(count)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      actionGrantedViews === count
                        ? "bg-sky-500/20 border-sky-500 text-sky-400 shadow-sm shadow-sky-500/20"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    +{count} {count === 1 ? "مشاهدة" : count === 2 ? "مشاهدتان" : "مشاهدات"}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={20}
                value={actionGrantedViews}
                onChange={(e) => setActionGrantedViews(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ملاحظات للمعلم / تظهر للطالب (اختياري):
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="مثال: تم منحك محاولتين لمراجعة الفصل قبل اختبار الغد..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleViewAction(selectedViewReq.id, "approve")}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>✓</span>
                <span>قبول ومنح ({actionGrantedViews}) مشاهدات</span>
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleViewAction(selectedViewReq.id, "reject")}
                className="px-5 py-3 border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                رفض الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Action Modal */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">مراجعة طلب تعديل درجة</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{selectedReq.student.name} · {selectedReq.quiz.title}</p>

            <div className="mb-4">
              <label className="block text-sm text-slate-500 dark:text-gray-400 mb-2">الدرجة الجديدة (لو موافق):</label>
              <input
                type="number"
                step="0.5"
                value={actionScore}
                onChange={(e) => setActionScore(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-white"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm text-slate-500 dark:text-gray-400 mb-2">ملاحظات للمتعلم:</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-white"
                placeholder="اكتب ملاحظتك للمتعلم..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleGradeAction(selectedReq.id, "approve")}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
              >
                ✓ قبول وتعديل
              </button>
              <button
                onClick={() => handleGradeAction(selectedReq.id, "reject")}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold cursor-pointer"
              >
                ✗ رفض
              </button>
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Resolve Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">حل التذكرة</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{selectedTicket.title}</p>

            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-white mb-5"
              placeholder="اكتب الحل أو الرد على المتعلم..."
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleTicketResolve(selectedTicket.id, "resolved")}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
              >
                ✓ تم الحل
              </button>
              <button
                onClick={() => handleTicketResolve(selectedTicket.id, "escalated")}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold cursor-pointer"
              >
                ↑ تصعيد للإدارة
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer"
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
