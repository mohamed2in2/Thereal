"use client";

import type { PaymentMethodConfig } from "@/lib/payment-methods";

/**
 * Provider brand tile: 40x40 (rounded-8px) holding brand mark.
 * Solid background, no gradients, no shadows, no emoji.
 */
export function PaymentProviderIcon({
  method,
}: {
  method: PaymentMethodConfig;
  size?: number;
}) {
  let bgColor = method.brandColor || "#E4E7EC";
  let textColor = method.brandForeground || "#101828";
  let mark = method.monogram || "PAY";

  if (method.id === "vf_cash") {
    bgColor = "#E60000";
    textColor = "#FFFFFF";
    mark = "VF";
  } else if (method.id === "fawry" || method.id === "fawry_pay") {
    bgColor = "#FFC20E";
    textColor = "#000000";
    mark = "فوري";
  } else if (method.id === "wallet_balance" || method.category === "balance") {
    bgColor = "#047857";
    textColor = "#FFFFFF";
    mark = "رصيد";
  } else if (method.id === "instapay") {
    bgColor = "#0047BA";
    textColor = "#FFFFFF";
    mark = "IPN";
  } else if (method.id === "voucher") {
    bgColor = "#8B5CF6";
    textColor = "#FFFFFF";
    mark = "كود";
  }

  return (
    <span
      aria-hidden
      className="w-10 h-10 rounded-lg flex shrink-0 items-center justify-center font-semibold text-[13px] leading-none tabular-nums"
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {mark}
    </span>
  );
}

