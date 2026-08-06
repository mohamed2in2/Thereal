"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

/**
 * In-app confirmation modal — replaces the native window.confirm() for delete
 * actions. Controlled: render it once and toggle `open`. Design-token styled,
 * RTL, Escape-to-cancel, focus-safe.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          dir="rtl"
        >
          <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-[var(--z-modal)] w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-2">
              <span className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${danger ? "bg-[var(--error)]/12 text-[var(--error)]" : "bg-sky-500/12 text-sky-500"}`}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {danger
                    ? <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>
                    : <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>}
                </svg>
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-black text-[var(--ink)] leading-snug">{title}</h2>
                {message && <p className="text-sm text-[var(--ink-muted)] mt-1 leading-relaxed">{message}</p>}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink-muted)]/40 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${danger ? "bg-[var(--error)] hover:opacity-90" : "bg-sky-500 hover:bg-sky-400"}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
