"use client";

/**
 * Full-section spinner used while the wizard is waiting on an async action
 * (creating the invoice, fetching method list, etc).
 */
export function LoadingState({ label = "جاري التحميل …" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" dir="rtl">
      <svg
        className="h-8 w-8 animate-spin text-emerald-500 dark:text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
