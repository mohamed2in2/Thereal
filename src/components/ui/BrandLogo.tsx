"use client";

import { useState } from "react";

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function BrandLogo({ className = "", size = 36, showText = true }: BrandLogoProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className="relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-sky-700 flex items-center justify-center font-black text-white"
        style={{ width: size, height: size }}
      >
        {/* Instant CSS fallback badge so text & layout render with 0 delay on low internet */}
        <span className="text-sm font-black select-none" style={{ fontFamily: "var(--font-head)" }}>
          C
        </span>

        {/* Non-blocking background-loaded image logo */}
        <img
          src="/logo.jpeg"
          alt="Code-UP"
          loading="lazy"
          decoding="async"
          {...({ fetchPriority: "low" } as any)}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {showText && (
        <span
          className="font-black text-base tracking-tight"
          style={{ fontFamily: "var(--font-head)", color: "var(--ink)" }}
        >
          Code-UP
        </span>
      )}
    </div>
  );
}
