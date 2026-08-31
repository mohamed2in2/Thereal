"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

interface ToastContextValue {
  toast: (type: ToastType, text: string, durationMs?: number) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const STYLES: Record<ToastType, string> = {
  success:
    "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/90 dark:text-emerald-100",
  error:
    "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/90 dark:text-rose-100",
  info: "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/90 dark:text-sky-100",
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${STYLES[toast.type]}`}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-sm font-bold dark:bg-white/10">
        {ICONS[toast.type]}
      </span>
      <p className="flex-1 text-sm font-medium leading-6">{toast.text}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs opacity-60 hover:opacity-100 cursor-pointer"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, text: string) => {
    if (!text) return;
    setToasts((current) => {
      // Prevent spamming identical toast messages if one is already active
      if (current.some((t) => t.text === text && t.type === type)) {
        return current;
      }
      const id = `toast-${++idRef.current}`;
      return [...current.slice(-3), { id, type, text }];
    });
  }, []);

  const success = useCallback((text: string) => toast("success", text), [toast]);
  const error = useCallback((text: string) => toast("error", text), [toast]);
  const info = useCallback((text: string) => toast("info", text), [toast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success,
      error,
      info,
    }),
    [toast, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
