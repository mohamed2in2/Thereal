"use client";
import { useState } from "react";

interface ExtraField {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}

interface Props {
  title: string;
  description: string;
  actionLabel: string;
  variant: "danger" | "warning";
  /** Optional extra input rendered above the password field (e.g. new teacher name) */
  extraField?: ExtraField;
  /** Receives the admin password. Should throw an Error with an Arabic message on failure. */
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

export function ConfirmActionModal({
  title,
  description,
  actionLabel,
  variant,
  extraField,
  onConfirm,
  onClose,
}: Props) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isDanger = variant === "danger";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("أدخل كلمة مرور المشرف");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md"
        dir="rtl"
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 p-5 border-b border-gray-700 rounded-t-2xl ${
            isDanger ? "bg-red-950/40" : "bg-yellow-950/30"
          }`}
        >
          <span className="text-2xl">{isDanger ? "⚠️" : "🔔"}</span>
          <h2
            className={`font-bold text-lg ${
              isDanger ? "text-red-400" : "text-yellow-400"
            }`}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="mr-auto text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed">{description}</p>

          {/* Optional extra field (e.g. new name) */}
          {extraField && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {extraField.label}
              </label>
              <input
                type={extraField.type ?? "text"}
                required
                value={extraField.value}
                onChange={(e) => extraField.onChange(e.target.value)}
                placeholder={extraField.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Admin password */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              كلمة مرور المشرف للتأكيد
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="••••••••"
              className={`w-full px-3 py-2 rounded-lg bg-gray-900 border text-white text-sm focus:outline-none focus:ring-1 ${
                error
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-600 focus:ring-blue-500"
              }`}
            />
            {error && (
              <p className="mt-1 text-xs text-red-400">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors ${
                isDanger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              {submitting ? "جارٍ التنفيذ..." : actionLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-gray-300 text-sm rounded-xl transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
