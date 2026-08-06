"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  teacherId: string;
  teacherName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({ teacherId, teacherName, onClose, onSuccess }: Props) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toastError("كلمتا المرور غير متطابقتان");
      return;
    }
    if (newPassword.length < 6) {
      toastError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        toastSuccess(`تم تغيير كلمة مرور "${teacherName}" بنجاح`);
        onSuccess();
      } else {
        toastError(data.error ?? "تعذر تغيير كلمة المرور");
      }
    } catch {
      toastError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-white font-bold">تغيير كلمة المرور</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-gray-400 text-sm">
            تغيير كلمة مرور المعلم:{" "}
            <span className="text-white font-semibold">{teacherName}</span>
          </p>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
