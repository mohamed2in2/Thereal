"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  UserCheck,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  Key,
  Trash2,
  Activity,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  PlayCircle,
  CreditCard,
  FileText,
} from "lucide-react";

interface TesterCapabilities {
  bypassPayment: boolean;
  unlimitedWatches: boolean;
  isolatedExams: boolean;
  aiTesterContext: boolean;
}

interface TesterAccount {
  id: string;
  name: string;
  phone: string;
  email: string;
  accountMode: string;
  capabilities: TesterCapabilities;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  stats: {
    activityLogsCount: number;
    enrolledCoursesCount: number;
    folderPurchasesCount: number;
    videoPurchasesCount: number;
    watchSessionsCount: number;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  targetId: string | null;
  targetTitle: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

type ModalState =
  | { type: "create" }
  | { type: "edit"; tester: TesterAccount }
  | { type: "reset_password"; tester: TesterAccount }
  | { type: "activity"; tester: TesterAccount }
  | { type: "delete"; tester: TesterAccount }
  | null;

export function TestersSection() {
  const [testers, setTesters] = useState<TesterAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "مختبر المنصة (QA Tester)",
    phone: "",
    password: "",
    notes: "",
    capabilities: {
      bypassPayment: true,
      unlimitedWatches: true,
      isolatedExams: true,
      aiTesterContext: true,
    },
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    notes: "",
    capabilities: {
      bypassPayment: true,
      unlimitedWatches: true,
      isolatedExams: true,
      aiTesterContext: true,
    },
  });

  // Reset password state
  const [newPassword, setNewPassword] = useState("");

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const fetchTesters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/superadmin/testers", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setTesters(data.testers || []);
      }
    } catch (e) {
      console.error("Failed to load testers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTesters();
  }, []);

  const openCreateModal = () => {
    setActionError("");
    setCreateForm({
      name: "مختبر المنصة (QA Tester)",
      phone: "",
      password: "",
      notes: "",
      capabilities: {
        bypassPayment: true,
        unlimitedWatches: true,
        isolatedExams: true,
        aiTesterContext: true,
      },
    });
    setModal({ type: "create" });
  };

  const openEditModal = (tester: TesterAccount) => {
    setActionError("");
    setEditForm({
      name: tester.name,
      notes: tester.notes || "",
      capabilities: { ...tester.capabilities },
    });
    setModal({ type: "edit", tester });
  };

  const openActivityModal = async (tester: TesterAccount) => {
    setModal({ type: "activity", tester });
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/admin/superadmin/testers/${tester.id}/activity`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setActivityLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to load activity logs:", e);
    } finally {
      setActivityLoading(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setActionError("");
    setNewPassword("");
  };

  // Handle Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError("");

    try {
      const res = await fetch("/api/admin/superadmin/testers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "تعذر إنشاء حساب الفحص");
        return;
      }

      closeModal();
      fetchTesters();
    } catch {
      setActionError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  // Handle Edit
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "edit") return;
    setBusy(true);
    setActionError("");

    try {
      const res = await fetch(`/api/admin/superadmin/testers/${modal.tester.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "تعذر تحديث الحساب");
        return;
      }

      closeModal();
      fetchTesters();
    } catch {
      setActionError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "reset_password") return;
    setBusy(true);
    setActionError("");

    try {
      const res = await fetch(`/api/admin/superadmin/testers/${modal.tester.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "تعذر تغيير كلمة المرور");
        return;
      }

      closeModal();
    } catch {
      setActionError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (tester: TesterAccount) => {
    try {
      const res = await fetch(`/api/admin/superadmin/testers/${tester.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tester.isActive }),
      });

      if (res.ok) {
        fetchTesters();
      }
    } catch (e) {
      console.error("Failed to toggle status:", e);
    }
  };

  // Handle Delete
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "delete") return;
    setBusy(true);
    setActionError("");

    try {
      const res = await fetch(`/api/admin/superadmin/testers/${modal.tester.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "تعذر حذف الحساب");
        return;
      }

      closeModal();
      fetchTesters();
    } catch {
      setActionError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const filteredTesters = testers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-slate-700/50 text-slate-200 border border-slate-600/50">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  حسابات الفحص وضمان الجودة (QA Testers)
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    عزل تام عن المعلمين
                  </span>
                </h2>
                <p className="text-sm text-gray-300 mt-1">
                  إدارة حسابات الفحص البرمجية المخصصة لاختبار الكورسات، تجاوز الدفع، والمشاهدات غير المحدودة بدون تلويث بيانات المعلمين أو السجلات المالية.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            إنشاء حساب فاحص
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-700/60 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>غير مرئي لجميع المعلمين 100%</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>مشاهدات فيديو غير محدودة</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تخطي بوابات الدفع بأمان</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>سجلات وتجارب معزولة</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث برقم الهاتف، الاسم، أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-gray-900/80 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/50"
          />
        </div>

        <button
          onClick={fetchTesters}
          title="تحديث البيانات"
          className="p-2.5 bg-gray-900 border border-gray-700 rounded-xl text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-slate-300" : ""}`} />
        </button>
      </div>

      {/* Testers List Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
            <p>جارٍ تحميل حسابات الفحص...</p>
          </div>
        ) : filteredTesters.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShieldAlert className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="font-semibold text-white">لا توجد حسابات فحص مطابقة</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? "جرّب البحث بكلمات أخرى" : "يمكنك إنشاء أول حساب فاحص للبدء في اختبار المنصة بأمان"}
            </p>
            {!searchQuery && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                إنشاء أول حساب فاحص
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-700/80">
            {filteredTesters.map((tester) => (
              <div key={tester.id} className="p-5 hover:bg-gray-750/50 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                {/* Account Details */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600/50 flex items-center justify-center text-slate-200 font-bold text-lg shrink-0">
                    QA
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-base truncate">{tester.name}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                        {tester.phone}
                      </span>
                      {tester.isActive ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          نشط
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                          موقوف
                        </span>
                      )}
                    </div>

                    {tester.notes && (
                      <p className="text-xs text-gray-300 mt-1 bg-gray-900/60 px-2.5 py-1 rounded-lg border border-gray-700/60 inline-block">
                        📝 {tester.notes}
                      </p>
                    )}

                    {/* Capabilities Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {tester.capabilities.bypassPayment && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> تجاوز الدفع
                        </span>
                      )}
                      {tester.capabilities.unlimitedWatches && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <PlayCircle className="w-3 h-3" /> مشاهدات لا نهائية
                        </span>
                      )}
                      {tester.capabilities.isolatedExams && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> عزل الاختبارات
                        </span>
                      )}
                      {tester.capabilities.aiTesterContext && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> تشخيص AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-700/60">
                  <div className="text-left hidden sm:block">
                    <p className="text-xs text-gray-400">سجل النشاطات</p>
                    <p className="text-sm font-semibold text-white font-mono">{tester.stats.activityLogsCount} حدث</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openActivityModal(tester)}
                      title="عرض سجل نشاطات الفحص"
                      className="p-2 text-indigo-300 hover:bg-indigo-900/30 rounded-xl transition-colors border border-indigo-500/20"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(tester)}
                      title="تعديل الصلاحيات والملاحظات"
                      className="p-2 text-purple-300 hover:bg-purple-900/30 rounded-xl transition-colors border border-purple-500/20"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActionError("");
                        setNewPassword("");
                        setModal({ type: "reset_password", tester });
                      }}
                      title="إعادة تعيين كلمة المرور"
                      className="p-2 text-amber-300 hover:bg-amber-900/30 rounded-xl transition-colors border border-amber-500/20"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(tester)}
                      title={tester.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
                      className={`p-2 rounded-xl transition-colors border ${
                        tester.isActive
                          ? "text-orange-400 hover:bg-orange-900/30 border-orange-500/20"
                          : "text-emerald-400 hover:bg-emerald-900/30 border-emerald-500/20"
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActionError("");
                        setModal({ type: "delete", tester });
                      }}
                      title="حذف الحساب"
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded-xl transition-colors border border-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Create Tester ── */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
                إنشاء حساب فاحص جديد (QA Tester)
              </h3>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">اسم الحساب</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="مختبر الدفع والجودة"
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">رقم هاتف الدخول (مصري)</label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="01012345678"
                    className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">يُشترط ألا يكون مستخدماً لحساب طالب موجود</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">ملاحظات المشرف العام (اختياري)</label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="مخصص لفحص بوابات الشحن وسيناريوهات الامتحانات"
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Capabilities Toggles */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-purple-300 mb-2">صلاحيات وقدرات الفحص الممنوحة:</label>
                <div className="space-y-2 bg-gray-900/60 p-3 rounded-xl border border-gray-700/80">
                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      تجاوز الدفع (Bypass Payment)
                    </span>
                    <input
                      type="checkbox"
                      checked={createForm.capabilities.bypassPayment}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          capabilities: { ...createForm.capabilities, bypassPayment: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-amber-400" />
                      مشاهدات لا نهائية للفيديوهات المحمية (Unlimited Watches)
                    </span>
                    <input
                      type="checkbox"
                      checked={createForm.capabilities.unlimitedWatches}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          capabilities: { ...createForm.capabilities, unlimitedWatches: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-400" />
                      عزل إجابات الامتحانات عن المعلمين (Isolated Exams)
                    </span>
                    <input
                      type="checkbox"
                      checked={createForm.capabilities.isolatedExams}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          capabilities: { ...createForm.capabilities, isolatedExams: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      سياق تشخيص الذكاء الاصطناعي (AI Diagnostic Context)
                    </span>
                    <input
                      type="checkbox"
                      checked={createForm.capabilities.aiTesterContext}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          capabilities: { ...createForm.capabilities, aiTesterContext: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "جارٍ الحفظ..." : "تأكيد الإنشاء"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Edit Capabilities ── */}
      {modal?.type === "edit" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEdit}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                تعديل صلاحيات الفاحص: {modal.tester.name}
              </h3>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">اسم الحساب</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">الملاحظات</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-purple-300 mb-2">الصلاحيات النشطة:</label>
                <div className="space-y-2 bg-gray-900/60 p-3 rounded-xl border border-gray-700/80">
                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      تجاوز الدفع (Bypass Payment)
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.capabilities.bypassPayment}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          capabilities: { ...editForm.capabilities, bypassPayment: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-amber-400" />
                      مشاهدات لا نهائية (Unlimited Watches)
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.capabilities.unlimitedWatches}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          capabilities: { ...editForm.capabilities, unlimitedWatches: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-400" />
                      عزل الامتحانات (Isolated Exams)
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.capabilities.isolatedExams}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          capabilities: { ...editForm.capabilities, isolatedExams: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      سياق تشخيص الذكاء الاصطناعي (AI Diagnostic Context)
                    </span>
                    <input
                      type="checkbox"
                      checked={editForm.capabilities.aiTesterContext}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          capabilities: { ...editForm.capabilities, aiTesterContext: e.target.checked },
                        })
                      }
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Reset Password ── */}
      {modal?.type === "reset_password" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              تغيير كلمة المرور
            </h3>
            <p className="text-xs text-gray-400">
              للفاحص: <span className="text-white font-medium">{modal.tester.name}</span> ({modal.tester.phone})
            </p>

            {actionError && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Activity Logs ── */}
      {modal?.type === "activity" && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  سجل نشاطات الفاحص: {modal.tester.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{modal.tester.phone}</p>
              </div>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activityLoading ? (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <p className="text-sm">جارٍ تحميل سجل النشاطات...</p>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد نشاطات مسجلة لهذا الحساب بعد</p>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-gray-900/80 border border-gray-700/80 rounded-xl space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {log.action}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {new Date(log.createdAt).toLocaleString("ar-EG")}
                      </span>
                    </div>

                    {log.targetTitle && (
                      <p className="text-white font-medium">
                        الهدف: <span className="text-purple-300">{log.targetTitle}</span>
                        {log.targetId && <span className="text-gray-500 text-[11px] ml-1 font-mono">({log.targetId})</span>}
                      </p>
                    )}

                    {log.details && (
                      <pre className="p-2 bg-gray-950 rounded-lg text-gray-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                        {log.details}
                      </pre>
                    )}

                    {log.ipAddress && (
                      <p className="text-[11px] text-gray-500 font-mono">IP: {log.ipAddress}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-700 pt-3 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete ── */}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDelete}
            className="bg-gray-800 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              حذف حساب الفاحص
            </h3>
            <p className="text-gray-300 text-sm">
              هل أنت متأكد من حذف حساب الفاحص{" "}
              <span className="text-white font-semibold">{modal.tester.name}</span> ({modal.tester.phone})؟
            </p>

            {actionError && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
                {actionError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "جارٍ الحذف..." : "تأكيد الحذف"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
