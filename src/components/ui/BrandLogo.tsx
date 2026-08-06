"use client";

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
}

export function BrandLogo({
  className = "",
  size = 32,
  showText = true,
  showTagline = true,
}: BrandLogoProps) {
  const height = Math.round(size * 1.18);

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Teal rounded badge with inner rectangle outline matching user image */}
      <div
        className="shrink-0 rounded-lg bg-[#009688] flex items-center justify-center shadow-md p-[3px] transition-transform hover:scale-105"
        style={{ width: size, height: height }}
      >
        <div className="w-full h-full border-[2.2px] border-white rounded-[3px]" />
      </div>

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

