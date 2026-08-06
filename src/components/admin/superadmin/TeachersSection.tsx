"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { hasPermission } from "@/lib/rbac";

interface CourseItem {
  id: string;
  title: string;
  subject: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  promoProgramEnabled?: boolean;
  promoCode?: string;
  _count: { courses: number };
  courses: CourseItem[];
}

export function TeachersSection({ userRole = "superadmin" }: { userRole?: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [togglingPromo, setTogglingPromo] = useState<string | null>(null);

  const togglePromoProgram = async (t: Teacher) => {
    setTogglingPromo(t.id);
    const newVal = !t.promoProgramEnabled;
    try {
      const res = await fetch(`/api/admin/superadmin/teachers/${t.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoProgramEnabled: newVal }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeachers((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, promoProgramEnabled: newVal } : item))
        );
        toastSuccess(`تم ${newVal ? "تفعيل" : "تعطيل"} برنامج الإحالة للمعلم "${t.name}"`);
      } else {
        toastError(data.error || "تعذر تغيير حالة البرنامج");
      }
    } catch {
      toastError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setTogglingPromo(null);
    }
  };

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teachers", { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("/api/admin/teachers failed:", res.status, txt);
        throw new Error(txt || "تعذر جلب المعلمين");
      }

      let data: { teachers?: Teacher[] } | undefined;
      try {
        data = (await res.json()) as { teachers?: Teacher[] };
      } catch (err) {
        console.error("Invalid JSON from /api/admin/teachers:", err);
        throw new Error("تعذر جلب المعلمين");
      }

      setTeachers(data?.teachers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const openEdit = (t: Teacher) => {
    setEditName(t.name);
    setEditTarget({ id: t.id, name: t.name });
  };

  const handleEditName = async (password: string) => {
    if (!editTarget) return;
    const res = await fetch(`/api/admin/teachers/${editTarget.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: password, name: editName }),
    });
    const json = (await res.json()) as { error?: string; teacher?: { id: string; name: string } };
    if (!res.ok) throw new Error(json.error ?? "تعذر تعديل الاسم");
    setTeachers((prev) =>
      prev.map((t) => (t.id === editTarget.id ? { ...t, name: json.teacher?.name ?? editName } : t))
    );
    toastSuccess(`تم تعديل اسم المعلم بنجاح`);
    setEditTarget(null);
  };

  const handleDelete = async (password: string) => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/teachers/${deleteTarget.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword: password }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "تعذر حذف حساب المعلم");
    setTeachers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    toastSuccess(`تم حذف حساب المعلم بنجاح`);
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-500" dir="rtl">
        جارٍ التحميل...
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-bold">
            المعلمون ({teachers.length})
          </h3>
          <button
            onClick={() => void fetchTeachers()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            ↻ تحديث
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <div className="text-4xl mb-2">👨‍🏫</div>
            <p>لا يوجد مدرسون بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-gray-700">
            {teachers.map((t) => (
              <div key={t.id}>
                {/* Teacher row */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center text-white font-bold shrink-0">
                      {t.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 truncate">{t.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t._count.courses} كورس · انضم{" "}
                        {new Date(t.createdAt).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {userRole === "superadmin" && (
                      <button
                        onClick={() => togglePromoProgram(t)}
                        disabled={togglingPromo === t.id}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                          t.promoProgramEnabled
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-gray-700/50 hover:bg-gray-700 text-gray-400 border-gray-600"
                        }`}
                      >
                        🏷️ برنامج الإحالة: {t.promoProgramEnabled ? "مُفعّل ✅" : "معطّل ❌"}
                      </button>
                    )}
                    {hasPermission(userRole, "edit_teacher_name") && (
                    <button
                      onClick={() => openEdit(t)}
                      className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                    >
                      ✏️ تعديل الاسم
                    </button>
                    )}
                    {hasPermission(userRole, "reset_teacher_password") && (
                    <button
                      onClick={() => setResetTarget({ id: t.id, name: t.name })}
                      className="px-3 py-1.5 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg transition-colors"
                    >
                      🔑 كلمة المرور
                    </button>
                    )}
                    {hasPermission(userRole, "delete_teacher") && (
                    <button
                      onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                      className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                    >
                      🗑️ حذف
                    </button>
                    )}
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                    >
                      {expandedId === t.id ? "إخفاء" : "الكورسات"}
                    </button>
                  </div>
                </div>

                {/* Expanded courses */}
                {expandedId === t.id && (
                  <div className="px-4 pb-4 border-t border-gray-700 bg-gray-900/30">
                    <p className="text-xs text-gray-400 mt-3 mb-2 font-semibold">
                      الكورسات المسندة:
                    </p>
                    {t.courses.length === 0 ? (
                      <p className="text-xs text-gray-500">لا توجد كورسات بعد</p>
                    ) : (
                      <div className="space-y-1.5">
                        {t.courses.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2 border border-gray-700"
                          >
                            <span className="text-blue-400">📚</span>
                            <span className="text-white">{c.title}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-400">{c.subject}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {resetTarget && (
        <ResetPasswordModal
          teacherId={resetTarget.id}
          teacherName={resetTarget.name}
          onClose={() => setResetTarget(null)}
          onSuccess={() => setResetTarget(null)}
        />
      )}

      {editTarget && (
        <ConfirmActionModal
          title="تعديل اسم المعلم"
          description={`تعديل اسم المعلم "‏${editTarget.name}‏". أدخل الاسم الجديد وكلمة مرور المشرف للتأكيد.`}
          actionLabel="حفظ الاسم"
          variant="warning"
          extraField={{
            label: "الاسم الجديد",
            placeholder: "أدخل الاسم الجديد",
            value: editName,
            onChange: setEditName,
          }}
          onConfirm={handleEditName}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmActionModal
          title="حذف حساب المعلم نهائياً"
          description={`تحذير: سيتم حذف حساب المعلم "‏${deleteTarget.name}‏" وجميع كورساته نهائياً. سيفقد المتعلمين الوصول لهذه الكورسات.`}
          actionLabel="حذف نهائياً"
          variant="danger"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
