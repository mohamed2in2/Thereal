import React from "react";

interface DemoBannerProps {
  show?: boolean;
}

export function DemoBanner({ show = true }: DemoBannerProps) {
  if (!show) return null;

  return (
    <div
      role="banner"
      dir="rtl"
      className="sticky top-0 z-50 w-full py-2.5 px-4 text-center text-xs sm:text-sm font-black text-amber-900 shadow-md flex items-center justify-center gap-2 select-none"
      style={{
        background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
        borderBottom: "2px dashed #d97706",
      }}
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px]">
        ⚙️
      </span>
      <span>وضع العرض — بيانات تجريبية ومرئية للإدارة فقط</span>
    </div>
  );
}
