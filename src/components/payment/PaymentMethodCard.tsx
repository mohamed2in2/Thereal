"use client";

import type { PaymentMethodConfig } from "@/lib/payment-methods";
import { PaymentProviderIcon } from "./PaymentProviderIcon";

/**
 * A single selectable payment-method card component.
 * Displays brand icon, title, description, fees, availability, and processing speed.
 */
export function PaymentMethodCard({
  method,
  selected,
  onSelect,
  onOpenDetails,
}: {
  method: PaymentMethodConfig;
  selected?: boolean;
  onSelect?: (m: PaymentMethodConfig) => void;
  onOpenDetails?: (m: PaymentMethodConfig) => void;
}) {
  const disabled = !method.available;

  return (
    <div
      dir="rtl"
      className={[
        "group relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all duration-200",
        disabled
          ? "border-gray-200 bg-gray-50/70 opacity-70 dark:border-gray-800 dark:bg-gray-900/50"
          : selected
            ? "border-emerald-500 bg-emerald-50/70 shadow-lg dark:border-emerald-400 dark:bg-emerald-950/40"
            : "border-gray-200 bg-white hover:border-emerald-400 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-500",
      ].join(" ")}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <PaymentProviderIcon method={method} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="truncate font-extrabold text-base text-gray-900 dark:text-white">
                {method.label}
              </h3>
              {!method.available && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  غير متاح حالياً
                </span>
              )}
              {method.available && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {method.feePercentage === 0 ? "بدون رسوم" : `رسوم ${method.feePercentage}%`}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {method.labelEn} • {method.processingSpeed}
            </p>
          </div>
        </div>

        {/* Radio Checkbox if in selection mode */}
        {onSelect && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(method)}
            className={[
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              selected && !disabled
                ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400"
                : "border-gray-300 text-transparent dark:border-gray-600 hover:border-emerald-400",
            ].join(" ")}
          >
            {selected && !disabled && (
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Description */}
      <p className="mt-3.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-2">
        {method.description}
      </p>

      {/* Unavailable note if disabled */}
      {!method.available && method.unavailableNote && (
        <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {method.unavailableNote}
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
          الحد: {method.minAmount} - {method.maxAmount.toLocaleString()} ج.م
        </span>

        <div className="flex items-center gap-2">
          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(method)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline"
            >
              التعليمات والتفاصيل ←
            </button>
          )}
          {onSelect && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(method)}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {selected ? "محدد" : "اختيار"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
