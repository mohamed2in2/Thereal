"use client";
import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { EDUCATIONAL_STAGES } from "@/types";
import { hasPermission } from "@/lib/rbac";

interface DeletedStudent {
  id: string;
  name: string;
  age: number | null;
  educationalStage: string | null;
  phone: string | null;
  deletedAt: string | null;
  createdAt: string;
}

type ModalAction = { type: "restore" | "hard_delete"; student: DeletedStudent } | null;

const PAGE_SIZE = 20;

function stageLabel(v: string | null) {
  if (!v) return "—";
  return EDUCATIONAL_STAGES.find((s) => s.value === v)?.label ?? v;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG");
}

export function DeletedStudentsSection({ userRole = "superadmin" }: { userRole?: string }) {
  const { success: toastSuccess } = useToast();
  const [students, setStudents] = useState<DeletedStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [nameFilter, setNameFilter] = useState("");
  const [lastFilter, setLastFilter] = useState("");
  const [modalAction, setModalAction] = useState<ModalAction>(null);

  const fetchDeleted = useCallback(async (name: string, pageOffset: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (name) params.set("name", name);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset * PAGE_SIZE));

    try {
      const res = await fetch(
        `/api/admin/superadmin/students/deleted?${params.toString()}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as { students?: DeletedStudent[]; total?: number };
      if (res.ok) {
        setStudents(data.students ?? []);
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
    setLastFilter(nameFilter);
    void fetchDeleted(nameFilter, 0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchDeleted(lastFilter, newPage);
  };

  const handleRestore = async (password: string) => {
    if (!modalAction || modalAction.type !== "restore") return;
    const { student } = modalAction;
    const res = await fetch(
      `/api/admin/superadmin/students/${student.id}/restore`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionPassword: password }),
      }
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر استعادة الحساب");
    toastSuccess(`تم استعادة حساب ${student.name} بنجاح`);
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
    setTotal((t) => t - 1);
    setModalAction(null);
  };

  const handleHardDelete = async (password: string) => {
    if (!modalAction || modalAction.type !== "hard_delete") return;
    const { student } = modalAction;
    const res = await fetch(
      `/api/admin/superadmin/students/${student.id}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionPassword: password, permanent: true }),
      }
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر الحذف النهائي");
    toastSuccess(`تم حذف حساب ${student.name} نهائياً`);
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
    setTotal((t) => t - 1);
    setModalAction(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl" className="space-y-4">
      {/* Search */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-4 flex gap-3 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">بحث باسم المتعلم</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="اكتب اسم المتعلم..."
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? "جارٍ البحث..." : "عرض المحذوفين"}
        </button>
      </form>

      {/* Results */}
      {searched && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
            <span className="text-orange-400">🗑️</span>
            <p className="text-sm text-gray-300 font-medium">
              المتعلمين المؤرشفون ({total})
            </p>
          </div>

          {students.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p>لا يوجد طلاب مؤرشفون</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-200 dark:divide-gray-700">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 font-bold shrink-0">
                        {s.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.name}</p>
                        <p className="text-gray-500 text-xs">
                          {stageLabel(s.educationalStage)}
                          {s.age ? ` · ${s.age} سنة` : ""}
                        </p>
                        <p className="text-gray-600 text-xs">
                          أُرشف: {fmtDate(s.deletedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {hasPermission(userRole, "restore_student") && (
                      <button
                        onClick={() => setModalAction({ type: "restore", student: s })}
                        className="px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                      >
                        ↩️ استعادة
                      </button>
                      )}
                      {hasPermission(userRole, "hard_delete_student") && (
                      <button
                        onClick={() => setModalAction({ type: "hard_delete", student: s })}
                        className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                      >
                        🗑️ حذف نهائي
                      </button>
                      )}
                    </div>
                  </div>
                ))}
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
                      className="px-3 py-1.5 text-xs bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-white rounded-lg"
                    >
                      السابق
                    </button>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 text-xs bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-white rounded-lg"
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
          <div className="text-4xl mb-2">🗑️</div>
          <p>اضغط &quot;عرض المحذوفين&quot; لتحميل المتعلمين المؤرشفين</p>
        </div>
      )}

      {/* Restore modal */}
      {modalAction?.type === "restore" && (
        <ConfirmActionModal
          title="استعادة حساب المتعلم"
          description={`سيُعاد تفعيل حساب المتعلم "‏${modalAction.student.name}‏" ويستطيع تسجيل الدخول مجدداً.`}
          actionLabel="استعادة الحساب"
          variant="warning"
          onConfirm={handleRestore}
          onClose={() => setModalAction(null)}
        />
      )}

      {/* Hard delete modal */}
      {modalAction?.type === "hard_delete" && (
        <ConfirmActionModal
          title="حذف نهائي — لا يمكن التراجع"
          description={`تحذير: سيتم حذف بيانات المتعلم "‏${modalAction.student.name}‏" وجميع سجلاته بصورة نهائية تماماً غير قابلة للاسترداد.`}
          actionLabel="حذف نهائياً"
          variant="danger"
          onConfirm={handleHardDelete}
          onClose={() => setModalAction(null)}
        />
      )}
    </div>
  );
}
