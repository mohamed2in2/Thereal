"use client";

import type { PaymentMethodConfig } from "@/lib/payment-methods";

/**
 * Renders a provider brand badge: a styled container with custom monograms & iconography.
 * Fully dynamic and self-contained — no broken external images required.
 */
export function PaymentProviderIcon({
  method,
  size = 48,
}: {
  method: PaymentMethodConfig;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-2xl font-black leading-none shadow-sm transition-transform group-hover:scale-105"
      style={{
        width: size,
        height: size,
        background: method.brandColor,
        color: method.brandForeground,
        fontSize: Math.max(12, Math.round(size * 0.32)),
        boxShadow: `0 4px 12px ${method.brandColor}33`,
      }}
    >
      {method.monogram}
    </span>
  );
}
