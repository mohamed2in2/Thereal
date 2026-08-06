"use client";

/**
 * Success panel shown after payment is confirmed and balance credited.
 * Auto-redirects after `autoRedirectMs` if `redirectHref` is provided.
 */
import { useEffect } from "react";

export function SuccessState({
  amount,
  reference,
  redirectHref,
  autoRedirectMs = 3000,
  onRedirectNow,
}: {
  amount: number;
  reference?: string | null;
  redirectHref?: string | null;
  autoRedirectMs?: number;
  onRedirectNow?: () => void;
}) {
  useEffect(() => {
    if (!redirectHref) return;
    const t = setTimeout(() => {
      onRedirectNow?.();
      window.location.href = redirectHref;
    }, autoRedirectMs);
    return () => clearTimeout(t);
  }, [redirectHref, autoRedirectMs, onRedirectNow]);

  return (
    <div
      dir="rtl"
      className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/30"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
        <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div>
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
          تم شحن رصيدك بنجاح!
        </h3>
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">
          تمت إضافة {amount.toFixed(2)} جنيه إلى محفظتك
        </p>
        {reference && (
          <p className="mt-1 text-xs text-emerald-500 dark:text-emerald-400">
            رقم المرجع: {reference}
          </p>
        )}
      </div>
      {redirectHref && (
        <p className="text-xs text-emerald-500 dark:text-emerald-400">
          سيتم تحويلك تلقائياً خلال لحظات …
        </p>
      )}
    </div>
  );
}
