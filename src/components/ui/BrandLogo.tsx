"use client";

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
}

export function BrandLogo({
  className = "",
  size = 36,
  showText = true,
  showTagline = true,
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      <img
        src="/logo.jpeg"
        alt="Code-UP Logo"
        className="shrink-0 rounded-xl object-cover transition-transform hover:scale-105 shadow-sm"
        style={{ width: Math.round(size * 1.2), height: Math.round(size * 1.2) }}
      />

      {showText && (
        <div className="flex items-center gap-2 sm:gap-3 leading-none">
          <span
            className="font-black text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Code-UP
          </span>
          {showTagline && (
            <span
              className="hidden sm:inline-block text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 pr-2.5 mr-0.5 whitespace-nowrap"
              dir="rtl"
            >
              ذاكر · طبّق · تقدّم
            </span>
          )}
        </div>
      )}
    </div>
  );
}

