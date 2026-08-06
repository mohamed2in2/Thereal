"use client";

/**
 * Inline error panel with optional retry button.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-800 dark:bg-rose-950/30"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
          ✕
        </span>
        <div className="flex-1">
          <p className="font-medium text-rose-800 dark:text-rose-200">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border-2 border-rose-400 px-4 py-1.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
