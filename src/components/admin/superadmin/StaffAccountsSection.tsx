"use client";
import { useState, useEffect } from "react";
import { hasPermission } from "@/lib/rbac";

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  isActive: boolean;
  createdAt: string;
}

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

type Modal =
  | { type: "create" }
  | { type: "delete"; account: StaffAccount }
  | { type: "reset_password"; account: StaffAccount }
  | null;

const ROLE_LABELS: Record<string, string> = { admin: "مشرف", staff: "موظف" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  staff: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export function StaffAccountsSection({ userRole = "superadmin" }: { userRole?: string }) {
  const canManage = hasPermission(userRole, "manage_staff_accounts");
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  // Create form state
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff", actionPassword: "" });
  // Reset password form
  const [resetForm, setResetForm] = useState({ newPassword: "", actionPassword: "" });
  // Delete form
  const [deletePassword, setDeletePassword] = useState("");

  const fetchAccounts = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/superadmin/staff-accounts", { credentials: "include" });
    const data = await readJson<{ accounts?: StaffAccount[]; error?: string }>(res);
    setAccounts(data?.accounts ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => { await fetchAccounts(); };
    load();
  }, []);

  const openModal = (m: Modal) => { setActionError(""); setModal(m); };
  const closeModal = () => { setModal(null); setActionError(""); setDeletePassword(""); setResetForm({ newPassword: "", actionPassword: "" }); setForm({ name: "", email: "", password: "", role: "staff", actionPassword: "" }); };

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setActionError("");
    const res = await fetch("/api/admin/superadmin/staff-accounts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) { setActionError(data?.error ?? "تعذر إنشاء الحساب"); return; }
    closeModal();
    fetchAccounts();
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const handleToggleActive = async (account: StaffAccount, actionPassword: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/superadmin/staff-accounts/${account.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_active", actionPassword }),
    });
    setBusy(false);
    if (res.ok) fetchAccounts();
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "reset_password") return;
    setBusy(true); setActionError("");
    const res = await fetch(`/api/admin/superadmin/staff-accounts/${modal.account.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", ...resetForm }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) { setActionError(data?.error ?? "تعذر إعادة تعيين كلمة المرور"); return; }
    closeModal();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "delete") return;
    setBusy(true); setActionError("");
    const res = await fetch(`/api/admin/superadmin/staff-accounts/${modal.account.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: deletePassword }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) { setActionError(data?.error ?? "تعذر حذف الحساب"); return; }
    closeModal();
    fetchAccounts();
  };

  // ── Inline suspend toggle (asks for action password via small prompt) ─────
  const [suspendTarget, setSuspendTarget] = useState<{ account: StaffAccount; pw: string } | null>(null);

  const submitSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTarget) return;
    await handleToggleActive(suspendTarget.account, suspendTarget.pw);
    setSuspendTarget(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">حسابات المشرفين والموظفين</h2>
          <p className="text-sm text-gray-400 mt-1">إدارة حسابات الدخول للوحة الإدارة</p>
        </div>
        {canManage && (
        <button
          onClick={() => openModal({ type: "create" })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ＋ إضافة حساب
        </button>
        )}
      </div>

      {/* Accounts table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">جارٍ التحميل...</div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">👥</div>
            <p className="text-gray-400">لا توجد حسابات مشرفين أو موظفين بعد</p>
            {canManage && (
            <button
              onClick={() => openModal({ type: "create" })}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-colors"
            >
              إضافة أول حساب
            </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-gray-700">
            {accounts.map((acc) => (
              <div key={acc.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 ${acc.role === "admin" ? "bg-purple-600" : "bg-blue-600"}`}>
                    {acc.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white truncate">{acc.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[acc.role]}`}>
                        {ROLE_LABELS[acc.role]}
                      </span>
                      {!acc.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">موقوف</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{acc.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {new Date(acc.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                  {canManage && (<>
                  <button
                    title="إعادة تعيين كلمة المرور"
                    onClick={() => openModal({ type: "reset_password", account: acc })}
                    className="p-2 text-yellow-400 hover:bg-yellow-900/20 rounded-lg transition-colors text-sm"
                  >
                    🔑
                  </button>
                  <button
                    title={acc.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
                    onClick={() => setSuspendTarget({ account: acc, pw: "" })}
                    className={`p-2 rounded-lg transition-colors text-sm ${acc.isActive ? "text-orange-400 hover:bg-orange-900/20" : "text-green-400 hover:bg-green-900/20"}`}
                  >
                    {acc.isActive ? "⏸" : "▶"}
                  </button>
                  <button
                    title="حذف الحساب"
                    onClick={() => openModal({ type: "delete", account: acc })}
                    className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                  >
                    🗑️
                  </button>
                  </>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Suspend/Unsuspend inline modal ── */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitSuspend} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-white">
              {suspendTarget.account.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
            </h3>
            <p className="text-gray-400 text-sm">
              {suspendTarget.account.isActive
                ? `سيتم إيقاف حساب "${suspendTarget.account.name}" ومنعه من تسجيل الدخول.`
                : `سيتم إعادة تفعيل حساب "${suspendTarget.account.name}".`}
            </p>
            <input
              type="password"
              required
              placeholder="كلمة مرور الإجراء"
              value={suspendTarget.pw}
              onChange={(e) => setSuspendTarget({ ...suspendTarget, pw: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setSuspendTarget(null)} className="flex-1 py-2 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm">إلغاء</button>
              <button type="submit" disabled={busy} className={`flex-1 py-2 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-60 ${suspendTarget.account.isActive ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}>
                {busy ? "..." : suspendTarget.account.isActive ? "إيقاف" : "تفعيل"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Create modal ── */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">إضافة حساب جديد</h3>
            {actionError && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">{actionError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">الاسم الكامل</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أحمد محمد" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">البريد الإلكتروني</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ahmed@school.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">كلمة المرور</label>
                <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">الدور</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="staff">موظف (staff)</option>
                  <option value="admin">مشرف (admin)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">كلمة مرور الإجراء</label>
                <input required type="password" value={form.actionPassword} onChange={(e) => setForm({ ...form, actionPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="كلمة المرور التأكيدية" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm">إلغاء</button>
              <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-60">
                {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {modal?.type === "reset_password" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleResetPassword} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-white">إعادة تعيين كلمة المرور</h3>
            <p className="text-gray-400 text-sm">الحساب: <span className="text-white font-medium">{modal.account.name}</span></p>
            {actionError && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">{actionError}</p>}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">كلمة المرور الجديدة</label>
              <input required type="password" minLength={6} value={resetForm.newPassword}
                onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">كلمة مرور الإجراء</label>
              <input required type="password" value={resetForm.actionPassword}
                onChange={(e) => setResetForm({ ...resetForm, actionPassword: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="كلمة المرور التأكيدية" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm">إلغاء</button>
              <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-60">
                {busy ? "..." : "تحديث كلمة المرور"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete modal ── */}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDelete} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-red-400">حذف الحساب</h3>
            <p className="text-gray-400 text-sm">
              سيتم حذف حساب <span className="text-white font-medium">{modal.account.name}</span> ({modal.account.email}) بشكل نهائي.
            </p>
            {actionError && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">{actionError}</p>}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">كلمة مرور الإجراء للتأكيد</label>
              <input required type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="كلمة المرور التأكيدية" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm">إلغاء</button>
              <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-60">
                {busy ? "..." : "حذف نهائياً"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
