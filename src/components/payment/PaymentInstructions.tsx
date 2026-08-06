"use client";

import { useState } from "react";
import type { PaymentMethodConfig } from "@/lib/payment-methods";
import { PaymentProviderIcon } from "./PaymentProviderIcon";

/**
 * Renders method-specific payment instructions:
 * - brand header with provider icon and label
 * - ordered step list (Arabic RTL)
 * - reference number with a Copy button (when the gateway returns one)
 * - optional "Open Payment Page" button (when a URL is provided)
 *
 * Pure presentational — no business logic, no API calls.
 */
export function PaymentInstructions({
  method,
  reference,
  paymentPageUrl,
}: {
  method: PaymentMethodConfig;
  reference?: string | null;
  paymentPageUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked in non-secure contexts */
    }
  };

  return (
    <div dir="rtl" className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PaymentProviderIcon method={method} size={40} />
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">{method.label}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{method.labelEn}</p>
        </div>
      </div>

      {/* Reference number */}
      {reference && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            رقم المرجع
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 text-lg font-bold tracking-wider text-emerald-900 dark:bg-gray-900 dark:text-emerald-100">
              {reference}
            </code>
            <button
              type="button"
              onClick={copyReference}
              className="shrink-0 rounded-lg border-2 border-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              {copied ? "✓ تم النسخ" : "نسخ"}
            </button>
          </div>
        </div>
      )}

      {/* Step list */}
      {method.instructions.length > 0 && (
        <ol className="mt-4 space-y-2">
          {method.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-6">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Optional external payment page */}
      {paymentPageUrl && (
        <a
          href={paymentPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          فتح صفحة الدفع
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.6l-6.3 6.3a1 1 0 101.4 1.4L15 6.4V9a1 1 0 102 0V3a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 100-2H5z" />
          </svg>
        </a>
      )}
    </div>
  );
}
