"use client";

import { useEffect, useState, useCallback } from "react";
import { IconPlus, IconUsers, IconBook, IconClock } from "@/components/admin/AdminIcons";
import { useToast } from "@/components/ui/Toast";

interface SubscriptionItem {
  id: string;
  studentId: string;
  teacherId: string;
  planType: string;
  planLabel: string;
  amount: number;
  educationalStage: string | null;
  studentName: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  status: string;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    parentPhone: string | null;
    educationalStage: string | null;
    createdAt: string;
  };
}

const STAGE_LABELS: Record<string, string> = {
  sec_1: "أولى بكالوريا",
  sec_2: "ثانية بكالوريا",
  sec_3: "ثالثة ثانوية",
};

const PLAN_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  monthly: { label: "📅 اشتراك شهري", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  termly: { label: "📚 اشتراك ترم", bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  yearly: { label: "🎓 اشتراك سنوي", bg: "rgba(16,185,129,0.12)", color: "#10B981" },
};

export function TeacherSubscriptionsSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [studentInput, setStudentInput] = useState("");
  const [selectedPlanType, setSelectedPlanType] = useState("monthly");
  const [adding, setAdding] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (stageFilter) params.set("stage", stageFilter);
      if (planFilter) params.set("plan", planFilter);

      const res = await fetch(`/api/teacher/subscriptions?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data.subscriptions || []);
      } else {
        toastError(data.error || "تعذر جلب حجوزات الطلاب");
      }
    } catch {
      toastError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, planFilter, toastError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubscriptions();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchSubscriptions]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInput.trim()) {
      toastError("بريد أو هاتف الطالب مطلوب");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/teacher/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmailOrPhone: studentInput.trim(),
          planType: selectedPlanType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess("تم إضافة الطالب بنجاح إلى قائمة المشتركين");
        setAddModalOpen(false);
        setStudentInput("");
        fetchSubscriptions();
      } else {
        toastError(data.error || "تعذر إضافة الطالب");
      }
    } catch {
      toastError("حدث خطأ في الشبكة");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSubscription = async (sub: SubscriptionItem) => {
    const studentName = sub.studentName || sub.student.name || "الطالب";
    if (!window.confirm(`هل أنت تأكد من إلغاء وحذف اشتراك ${studentName} (${sub.planLabel})؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/teacher/subscriptions?id=${sub.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess("تم حذف وتفريغ الاشتراك بنجاح");
        fetchSubscriptions();
      } else {
        toastError(data.error || "تعذر حذف الاشتراك");
      }
    } catch {
      toastError("حدث خطأ في الشبكة أثناء الحذف");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--ink)] flex items-center gap-2">
            <IconUsers className="w-6 h-6 text-sky-500" />
            الطلاب الحاطين واشتراكاتهم
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            عرض وتصنيف جميع الطلاب الذين قاموا بحجز اشتراكاتك (شهري / ترم / سنوي) ومعلومات التواصل الخاصة بهم.
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-all shadow-md cursor-pointer shrink-0"
        >
          <IconPlus className="w-4 h-4" />
          إضافة طالب يدوياً
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث بالاسم أو الهاتف أو البريد..."
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:border-sky-400"
        />

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:border-sky-400"
        >
          <option value="">جميع المراحل الدراسية</option>
          <option value="sec_1">أولى بكالوريا</option>
          <option value="sec_2">ثانية بكالوريا</option>
          <option value="sec_3">ثالثة ثانوية</option>
        </select>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:border-sky-400"
        >
          <option value="">جميع باقات الاشتراك</option>
          <option value="monthly">اشتراك شهري</option>
          <option value="termly">اشتراك ترم كامل</option>
          <option value="yearly">اشتراك سنوي</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] block">إجمالي المشتركين</span>
          <span className="text-xl font-black text-sky-500">{subscriptions.length} طالب</span>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] block">اشتراكات شهرية</span>
          <span className="text-xl font-black text-blue-500">{subscriptions.filter((s) => s.planType === "monthly").length}</span>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] block">اشتراكات ترم</span>
          <span className="text-xl font-black text-amber-500">{subscriptions.filter((s) => s.planType === "termly").length}</span>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] block">اشتراكات سنوية</span>
          <span className="text-xl font-black text-emerald-500">{subscriptions.filter((s) => s.planType === "yearly").length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">جاري تحميل قائمة الطلاب...</div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">لا يوجد طلاب محجوزين يطابقون خيارات البحث.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--ink-muted)] font-bold">
                <tr>
                  <th className="p-4">الطالب</th>
                  <th className="p-4">المرحلة الدراسية</th>
                  <th className="p-4">الباقة المشتراة</th>
                  <th className="p-4">رقم التواصل</th>
                  <th className="p-4">تاريخ الحجز</th>
                  <th className="p-4 text-center">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {subscriptions.map((sub) => {
                  const name = sub.studentName || sub.student.name || "طالب";
                  const stage = STAGE_LABELS[sub.educationalStage || sub.student.educationalStage || ""] || sub.educationalStage || "-";
                  const badge = PLAN_BADGES[sub.planType] || { label: sub.planLabel, bg: "rgba(99,102,241,0.12)", color: "#6366f1" };
                  const phone = sub.studentPhone || sub.student.phone || "-";
                  const parentPhone = sub.parentPhone || sub.student.parentPhone || "-";

                  return (
                    <tr key={sub.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[var(--ink)]">{name}</div>
                        <div className="text-[10px] text-[var(--ink-muted)] font-mono">{sub.student.email}</div>
                      </td>
                      <td className="p-4 font-semibold text-[var(--ink)]">{stage}</td>
                      <td className="p-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {badge.label} ({sub.amount} ج.م)
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px] dir-ltr text-right">
                        <div>📱 الطالب: {phone}</div>
                        {parentPhone !== "-" && <div className="text-[10px] text-[var(--ink-muted)]">👨‍👩‍👦 ولي الأمر: {parentPhone}</div>}
                      </td>
                      <td className="p-4 text-[11px] text-[var(--ink-muted)]">
                        {new Date(sub.createdAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          🟢 نشط
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSubscription(sub)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[11px] font-bold transition-all cursor-pointer"
                          title="إلغاء وحذف اشتراك هذا الطالب"
                        >
                          🗑️ حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-2xl border border-[var(--border)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-[var(--ink)]">إضافة طالب إلى باقة يدوياً</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm">✕</button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-[var(--ink-muted)]">بريد الطالب أو رقم الهاتف:</label>
                <input
                  type="text"
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  placeholder="مثال: student@email.com أو 01012345678"
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--ink)] focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[var(--ink-muted)]">اختر باقة الاشتراك:</label>
                <select
                  value={selectedPlanType}
                  onChange={(e) => setSelectedPlanType(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--ink)] focus:outline-none focus:border-sky-400"
                >
                  <option value="monthly">📅 اشتراك شهري</option>
                  <option value="termly">📚 اشتراك ترم كامل</option>
                  <option value="yearly">🎓 اشتراك سنوي</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-3 rounded-xl bg-sky-500 text-white font-bold text-xs hover:bg-sky-400 transition-all disabled:opacity-50"
                >
                  {adding ? "جارٍ الإضافة..." : "حفظ وإضافة الطالب"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-3 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--bg)]"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
