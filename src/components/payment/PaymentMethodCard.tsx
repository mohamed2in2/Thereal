"use client";

import type { PaymentMethodConfig } from "@/lib/payment-methods";
import { PaymentProviderIcon } from "./PaymentProviderIcon";

/**
 * Single selectable payment method row.
 * 64px tall, 12px radius, 1px border (2px accent when selected), 16px padding.
 * Contains provider mark, 17px title, 13px subtitle, and 20px radio indicator.
 */
export function PaymentMethodCard({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethodConfig;
  selected?: boolean;
  onSelect?: (m: PaymentMethodConfig) => void;
  onOpenDetails?: (m: PaymentMethodConfig) => void;
}) {
  const disabled = !method.available;

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={selected ? 0 : -1}
      onClick={() => {
        if (!disabled && onSelect) {
          onSelect(method);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !disabled && onSelect) {
          e.preventDefault();
          onSelect(method);
        }
      }}
      className={[
        "h-[64px] rounded-xl px-4 flex items-center justify-between gap-3 cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981] focus-visible:ring-offset-2",
        disabled
          ? "border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] opacity-40 cursor-not-allowed"
          : selected
            ? "border-2 border-[#047857] dark:border-[#10B981] bg-[#047857]/5 dark:bg-[#10B981]/10"
            : "border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] hover:border-[#667085] dark:hover:border-[#98A2B3]",
      ].join(" ")}
    >
      {/* Start: Brand Tile + Name & Next step */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <PaymentProviderIcon method={method} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-[#101828] dark:text-[#F2F4F7] truncate leading-tight">
            {method.label}
          </div>
          <div className="text-[13px] font-medium text-[#667085] dark:text-[#98A2B3] truncate leading-tight mt-0.5">
            {disabled
              ? method.unavailableNote || "غير متاح حالياً"
              : method.shortNote || method.description}
          </div>
        </div>
      </div>

      {/* End: 20px Radio Circle */}
      <div
        aria-hidden
        className={[
          "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150",
          selected && !disabled
            ? "border-[#047857] dark:border-[#10B981] bg-[#047857] dark:bg-[#10B981]"
            : "border-[#667085] dark:border-[#98A2B3] bg-transparent",
        ].join(" ")}
      >
        {selected && !disabled && (
          <span className="w-2 h-2 rounded-full bg-white" />
        )}
      </div>
    </div>
  );
}

