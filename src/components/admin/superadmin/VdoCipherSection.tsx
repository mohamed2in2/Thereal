"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";

interface VdoCipherAccount {
  id: string;
  name: string;
  apiKeyMasked: string;
  playerId: string | null;
  bandwidthLimitBytes: number;
  bandwidthUsedBytes: number;
  bandwidthReservedBytes: number;
  bandwidthSafeRemainingBytes: number;
  bandwidthLimitGb: number;
  bandwidthUsedGb: number;
  bandwidthSafeRemainingGb: number;
  bandwidthPercentUsed: number;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
  isActive: boolean;
  notes: string | null;
  activeViewersCount: number;
  totalVideosCount: number;
  isEligibleForUpload: boolean;
  isEligibleForPlayback: boolean;
  createdAt: string;
  updatedAt: string;
}

interface KPIStats {
  totalAccounts: number;
  activeAccounts: number;
  expiredAccounts: number;
  totalBandwidthLimitGb: number;
  totalBandwidthUsedGb: number;
  totalSafeRemainingGb: number;
  totalActiveViewers: number;
}

export function VdoCipherSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const notify = (type: "success" | "error" | "info", text: string) => {
    if (type === "success") toastSuccess(text);
    else toastError(text);
  };
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<VdoCipherAccount[]>([]);
  const [kpis, setKpis] = useState<KPIStats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "near_limit" | "expired" | "inactive">("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<VdoCipherAccount | null>(null);
  const [reconciling, setReconciling] = useState(false);

  // Form State for Add
  const [addForm, setAddForm] = useState({
    name: "",
    apiKey: "",
    playerId: "",
    bandwidthLimitGb: 5,
    validityDays: 30,
    notes: "",
  });
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: "",
    apiKey: "",
    playerId: "",
    bandwidthLimitGb: 5,
    extendDays: 0,
    isActive: true,
    notes: "",
  });

  // Security passkey state for teachers
  const [securityPassword, setSecurityPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const fetchSecurityPassword = async () => {
    try {
      const res = await fetch("/api/admin/config", { credentials: "include" });
      const json = await res.json();
      if (res.ok && Array.isArray(json.groups)) {
        for (const group of json.groups) {
          const item = group.items?.find((i: any) => i.key === "vdocipher_security_password");
          if (item) {
            setSecurityPassword(item.value || "");
            break;
          }
        }
      }
    } catch {}
  };

  const handleSaveSecurityPassword = async () => {
    try {
      setSavingPass(true);
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "vdocipher_security_password",
          value: securityPassword.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "تعذر حفظ كلمة المرور");
      }
      notify("success", "تم تحديث كلمة مرور حماية VdoCipher للمعلمين بنجاح! 🔒");
    } catch (err: any) {
      notify("error", err.message || "فشل الحفظ");
    } finally {
      setSavingPass(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/superadmin/vdocipher");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر جلب بيانات الحسابات");
      }
      setAccounts(data.accounts || []);
      setKpis(data.kpis || null);
    } catch (err: any) {
      notify("error", err.message || "حدث خطأ أثناء تحميل الحسابات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchSecurityPassword();
  }, []);

  // Reconcile reservations
  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await fetch("/api/admin/superadmin/vdocipher/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشلت المزامنة");
      }
      setAccounts(data.accounts || []);
      notify("success", data.message || "تمت المزامنة وتحديث الحسابات بنجاح");
      fetchAccounts();
    } catch (err: any) {
      notify("error", err.message || "حدث خطأ أثناء المزامنة");
    } finally {
      setReconciling(false);
    }
  };

  // Test API Key
  const handleTestApiKey = async (apiKey: string, accountId?: string) => {
    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await fetch("/api/admin/superadmin/vdocipher/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, accountId }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, message: data.message });
      if (data.ok) {
        notify("success", data.message);
      } else {
        notify("error", data.error || data.message || "فحص الاتصال غير ناجح");
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || "فشل الاتصال" });
      notify("error", err.message || "تعذر إجراء فحص الاتصال");
    } finally {
      setTestingKey(false);
    }
  };

  // Submit Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.apiKey.trim()) {
      notify("error", "يرجى كتابة اسم الحساب ومفتاح الـ API");
      return;
    }

    try {
      setSavingAccount(true);
      const res = await fetch("/api/admin/superadmin/vdocipher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          apiKey: addForm.apiKey.trim(),
          playerId: addForm.playerId.trim() || null,
          bandwidthLimitGb: Number(addForm.bandwidthLimitGb) || 5,
          validityDays: Number(addForm.validityDays) || 30,
          notes: addForm.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إضافة الحساب");
      }

      notify("success", data.message || "تم إضافة الحساب بنجاح! 🎉");
      setShowAddModal(false);
      setAddForm({
        name: "",
        apiKey: "",
        playerId: "",
        bandwidthLimitGb: 5,
        validityDays: 30,
        notes: "",
      });
      setTestResult(null);
      fetchAccounts();
    } catch (err: any) {
      notify("error", err.message || "حدث خطأ أثناء حفظ الحساب");
    } finally {
      setSavingAccount(false);
    }
  };

  // Submit Edit Account
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      setSavingAccount(true);
      const res = await fetch(`/api/admin/superadmin/vdocipher/${editingAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          apiKey: editForm.apiKey.trim() || undefined,
          playerId: editForm.playerId.trim() || null,
          bandwidthLimitGb: Number(editForm.bandwidthLimitGb) || undefined,
          extendDays: Number(editForm.extendDays) || undefined,
          isActive: editForm.isActive,
          notes: editForm.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تحديث الحساب");
      }

      notify("success", data.message || "تم تحديث الحساب بنجاح");
      setEditingAccount(null);
      fetchAccounts();
    } catch (err: any) {
      notify("error", err.message || "حدث خطأ أثناء التحديث");
    } finally {
      setSavingAccount(false);
    }
  };

  // Toggle Account Active
  const handleToggleActive = async (account: VdoCipherAccount) => {
    try {
      const res = await fetch(`/api/admin/superadmin/vdocipher/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تعديل حالة الحساب");
      }
      notify("success", `تم ${account.isActive ? "تعطيل" : "تفعيل"} الحساب بنجاح`);
      fetchAccounts();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (account: VdoCipherAccount) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب "${account.name}"؟`)) return;
    try {
      const res = await fetch(`/api/admin/superadmin/vdocipher/${account.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حذف الحساب");
      }
      notify("success", data.message || "تم حذف الحساب");
      fetchAccounts();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (acc.notes && acc.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (acc.playerId && acc.playerId.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === "active") return acc.isActive && !acc.isExpired;
      if (statusFilter === "near_limit") return acc.bandwidthPercentUsed >= 80;
      if (statusFilter === "expired") return acc.isExpired;
      if (statusFilter === "inactive") return !acc.isActive;
      return true;
    });
  }, [accounts, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-sky-950/40 via-[var(--card)] to-slate-900/60 border border-sky-500/20 shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎬</span>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
              إدارة حسابات ومجمع باقات VdoCipher (Bandwidth Pool)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-1 max-w-2xl leading-relaxed">
            إدارة وتوزيع أكثر من 100 حساب VdoCipher تلقائياً، مع نظام المحاسبة السرية للباندويث (Secret Bandwidth Accounting) وتوزيع المشاهدات الذكي لمنع انقطاع الفيديوهات.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconciling}
            className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[var(--ink)] border border-white/10 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <span className={reconciling ? "animate-spin" : ""}>🔄</span>
            <span>{reconciling ? "جاري المزامنة..." : "مزامنة الحجوزات"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setTestResult(null);
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>➕</span>
            <span>إضافة حساب VdoCipher جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">إجمالي الحسابات</span>
          <div className="text-2xl font-black text-[var(--ink)] font-mono">{kpis?.totalAccounts ?? 0}</div>
          <span className="text-[10px] text-sky-400 font-bold block">
            {kpis?.activeAccounts ?? 0} حساب نشط
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">إجمالي الباندويث المتاح</span>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {kpis?.totalBandwidthLimitGb ?? 0} <span className="text-xs text-[var(--ink-muted)]">GB</span>
          </div>
          <span className="text-[10px] text-[var(--ink-muted)] block">السعة الكلية للمجمع</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">الباندويث المستهلك</span>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {kpis?.totalBandwidthUsedGb ?? 0} <span className="text-xs text-[var(--ink-muted)]">GB</span>
          </div>
          <span className="text-[10px] text-amber-500/80 font-bold block">استهلاك الطلاب الفعلي</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">السعة الآمنة المتبقية</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {kpis?.totalSafeRemainingGb ?? 0} <span className="text-xs text-[var(--ink-muted)]">GB</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold block">متاح للحجز والمشاهدة</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">المشاهدون النشطون الآن</span>
          <div className="text-2xl font-black text-indigo-400 font-mono flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>{kpis?.totalActiveViewers ?? 0}</span>
          </div>
          <span className="text-[10px] text-indigo-300 font-bold block">جلسات مشاهدة جارية</span>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] block">الحسابات المنتهية</span>
          <div className="text-2xl font-black text-rose-400 font-mono">{kpis?.expiredAccounts ?? 0}</div>
          <span className="text-[10px] text-rose-400/80 font-bold block">تتطلب تجديد الصلاحية</span>
        </div>
      </div>

      {/* 🔐 Teacher Security Passkey Configuration */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/20 via-[var(--card)] to-slate-900/30 border border-sky-500/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔐</span>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
              كلمة مرور حماية VdoCipher للمعلمين (Security Passkey)
            </h3>
          </div>
          <p className="text-[11px] text-[var(--ink-muted)] m-0 max-w-xl leading-relaxed">
            كلمة المرور المطلوبة التي يجب على المعلم إدخالها قبل الدخول إلى رفع فيديوهات VdoCipher لضمان عدم استهلاك الباندويث المحدود إلا بإذن مسبق.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type={showPass ? "text" : "password"}
              dir="ltr"
              placeholder="مثال: codeup2026"
              value={securityPassword}
              onChange={(e) => setSecurityPassword(e.target.value)}
              className="w-full px-3 py-2 pe-8 rounded-xl bg-black/30 border border-white/10 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-muted)] hover:text-white"
            >
              {showPass ? "👁️" : "🔒"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveSecurityPassword}
            disabled={savingPass}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {savingPass ? "جاري الحفظ..." : "حفظ كلمة المرور"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: "all", label: "الكل" },
              { id: "active", label: "النشطة" },
              { id: "near_limit", label: "شارفت على الانتهاء (≥80%)" },
              { id: "expired", label: "منتهية الصلاحية" },
              { id: "inactive", label: "معطلة" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === t.id
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-white/5 text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="بحث بالاسم، Player ID أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-black/20 border border-white/10 text-xs text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Accounts List Table / Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
          <span className="inline-block w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p>جاري تحميل حسابات VdoCipher والمحاسبة السرية...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-3">
          <span className="text-4xl block">🔍</span>
          <p className="text-sm font-bold text-[var(--ink)]">لا توجد حسابات مطابقة للفلاتر المحددة</p>
          <p className="text-xs text-[var(--ink-muted)]">يمكنك إضافة حساب جديد أو تغيير خيارات البحث.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const isFull = account.bandwidthPercentUsed >= 95;
            const isNearFull = account.bandwidthPercentUsed >= 80 && !isFull;

            return (
              <div
                key={account.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden bg-[var(--card)] ${
                  !account.isActive
                    ? "border-white/5 opacity-60"
                    : account.isExpired
                    ? "border-rose-500/30 bg-rose-500/5"
                    : isFull
                    ? "border-rose-500/40"
                    : isNearFull
                    ? "border-amber-500/40"
                    : "border-sky-500/20 hover:border-sky-500/40"
                }`}
              >
                {/* Header: Name + Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-[var(--ink)] flex items-center gap-1.5">
                      <span>🎬</span>
                      <span>{account.name}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-[var(--ink-muted)] select-all">
                        {account.apiKeyMasked}
                      </span>
                      {account.playerId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono">
                          Player: {account.playerId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {account.isExpired ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-bold text-[10px]">
                        منتهي
                      </span>
                    ) : !account.isActive ? (
                      <span className="px-2 py-0.5 rounded-md bg-gray-500/20 text-gray-400 font-bold text-[10px]">
                        معطل
                      </span>
                    ) : isFull ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-bold text-[10px]">
                        ممتلئ (100%)
                      </span>
                    ) : isNearFull ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                        شارف على الامتلاء
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        نشط ومتاح
                      </span>
                    )}
                  </div>
                </div>

                {/* Bandwidth Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ink-muted)]">استهلاك الباندويث:</span>
                    <span className="font-mono font-bold text-[var(--ink)]">
                      {account.bandwidthUsedGb} GB / {account.bandwidthLimitGb} GB
                      <span className="text-[10px] text-sky-400 ms-1">({account.bandwidthPercentUsed}%)</span>
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isFull
                          ? "bg-rose-500"
                          : isNearFull
                          ? "bg-amber-500"
                          : "bg-gradient-to-r from-sky-500 to-emerald-400"
                      }`}
                      style={{ width: `${account.bandwidthPercentUsed}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)]">
                    <span>
                      السعة الآمنة المتبقية:{" "}
                      <strong className="text-emerald-400 font-mono font-bold">
                        {account.bandwidthSafeRemainingGb} GB
                      </strong>
                    </span>
                    <span>
                      محجوز حالياً:{" "}
                      <strong className="text-indigo-300 font-mono">
                        {(account.bandwidthReservedBytes / (1024 * 1024)).toFixed(0)} MB
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-[11px]">
                  <div>
                    <span className="text-[var(--ink-muted)] block text-[10px]">الصلاحية:</span>
                    <span className={`font-bold ${account.isExpired ? "text-rose-400" : "text-[var(--ink)]"}`}>
                      {account.isExpired ? "منتهية" : `متبقي ${account.daysRemaining} يوم`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--ink-muted)] block text-[10px]">المشاهدون الآن:</span>
                    <span className="font-bold text-indigo-400 flex items-center gap-1">
                      {account.activeViewersCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                      )}
                      <span>{account.activeViewersCount} طالب</span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestApiKey("", account.id)}
                      disabled={testingKey}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-sky-400 border border-white/5 transition-all flex items-center gap-1 cursor-pointer"
                      title="فحص صلاحية مفتاح الـ API"
                    >
                      <span>🧪</span>
                      <span>فحص الاتصال</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(account);
                        setEditForm({
                          name: account.name,
                          apiKey: "",
                          playerId: account.playerId || "",
                          bandwidthLimitGb: account.bandwidthLimitGb,
                          extendDays: 0,
                          isActive: account.isActive,
                          notes: account.notes || "",
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-[var(--ink)] border border-white/5 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>تعديل</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(account)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        account.isActive
                          ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {account.isActive ? "تعطيل" : "تفعيل"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account)}
                      className="p-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="حذف الحساب"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[var(--card)] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
                <span>➕</span>
                <span>إضافة حساب VdoCipher جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[var(--ink-muted)] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">اسم / معرّف الحساب *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: VdoCipher Account #01"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">
                  مفتاح VdoCipher API Secret Key *
                </label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  placeholder="مثال: dWdltZ29BtysEGazrN00UDyIXfpg..."
                  value={addForm.apiKey}
                  onChange={(e) => setAddForm({ ...addForm, apiKey: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
                <span className="text-[10px] text-[var(--ink-muted)] mt-0.5 block">
                  🔒 يتم تشفير المفتاح تلقائياً بنظام AES-256-GCM ولا يتم إرساله للمتصفح أبداً.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink)] font-bold mb-1">حصة الباندويث (GB) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={addForm.bandwidthLimitGb}
                    onChange={(e) =>
                      setAddForm({ ...addForm, bandwidthLimitGb: parseFloat(e.target.value) || 5 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-[var(--ink-muted)] mt-0.5 block">افتراضي: 5 GB</span>
                </div>

                <div>
                  <label className="block text-[var(--ink)] font-bold mb-1">فترة الصلاحية (بالأيام) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={addForm.validityDays}
                    onChange={(e) =>
                      setAddForm({ ...addForm, validityDays: parseInt(e.target.value) || 30 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-[var(--ink-muted)] mt-0.5 block">افتراضي: 30 يوم</span>
                </div>
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">
                  معرّف الثيم / Player ID (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="مثال: customPlayerThemeId"
                  value={addForm.playerId}
                  onChange={(e) => setAddForm({ ...addForm, playerId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">ملاحظات داخلية (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: حساب مخصص لكورسات الثانوية العامة"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    testResult.ok
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span>{testResult.ok ? "✅" : "⚠️"}</span>
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleTestApiKey(addForm.apiKey)}
                  disabled={testingKey || !addForm.apiKey.trim()}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sky-400 font-bold border border-white/10 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🧪</span>
                  <span>{testingKey ? "جاري الفحص..." : "فحص المفتاح أولاً"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ink-muted)] font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingAccount ? "جاري الحفظ..." : "حفظ الحساب"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[var(--card)] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
                <span>✏️</span>
                <span>تعديل حساب: {editingAccount.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-[var(--ink-muted)] hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">اسم الحساب *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">
                  تحديث مفتاح API Secret (اتركه فارغاً للإبقاء على المفتاح الحالي)
                </label>
                <input
                  type="password"
                  dir="ltr"
                  placeholder="أدخل مفتاحاً جديداً فقط إذا كنت تريد تغييره..."
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink)] font-bold mb-1">حصة الباندويث (GB)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={editForm.bandwidthLimitGb}
                    onChange={(e) =>
                      setEditForm({ ...editForm, bandwidthLimitGb: parseFloat(e.target.value) || 5 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[var(--ink)] font-bold mb-1">تمديد الصلاحية (+ أيام)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="مثال: 30"
                    value={editForm.extendDays || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, extendDays: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">
                  معرّف الثيم / Player ID (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editForm.playerId}
                  onChange={(e) => setEditForm({ ...editForm, playerId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 font-mono text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[var(--ink)] font-bold mb-1">ملاحظات داخلية</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 text-[var(--ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5">
                <input
                  type="checkbox"
                  id="accountActiveCheckbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-white/20 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="accountActiveCheckbox" className="text-xs font-bold text-[var(--ink)] cursor-pointer">
                  الحساب نشط ومتاح لرفع وتعيين الفيديوهات الجديدة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ink-muted)] font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingAccount ? "جاري التحديث..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
