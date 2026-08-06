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
  const [tab, setTab] = useState<"grades" | "tickets">("grades");
  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<GradeRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [actionScore, setActionScore] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([
        fetch("/api/grade-requests").then((r) => r.json()),
        fetch("/api/tickets").then((r) => r.json()),
      ]);
      setGradeRequests(g.requests || []);
      setTickets(t.tickets || []);
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
  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("grades")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
            tab === "grades" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-gray-400 hover:text-white"
          }`}
        >
          🎯 طلبات تعديل الدرجات{" "}
          {pendingGrades.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {pendingGrades.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("tickets")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
            tab === "tickets" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-gray-400 hover:text-white"
          }`}
        >
          🎫 تذاكر الدعم{" "}
          {openTickets.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {openTickets.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-gray-400">جارٍ التحميل...</div>
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-bold"
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
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-bold"
                  >
                    حل التذكرة
                  </button>
                )}
              </div>
            ))
          )}
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
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
              >
                ✓ قبول وتعديل
              </button>
              <button
                onClick={() => handleGradeAction(selectedReq.id, "reject")}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
              >
                ✗ رفض
              </button>
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
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
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold"
              >
                ✓ تم الحل
              </button>
              <button
                onClick={() => handleTicketResolve(selectedTicket.id, "escalated")}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold"
              >
                ↑ تصعيد للإدارة
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
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
