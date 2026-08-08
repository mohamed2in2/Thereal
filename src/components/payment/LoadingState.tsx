"use client";

/**
 * Full-section spinner used while waiting on async actions.
 * One centred 24px spinner, one 15px line of text.
 */
export function LoadingState({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12" dir="rtl">
      <svg
        className="w-6 h-6 animate-spin text-[#047857] dark:text-[#10B981]"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <p className="text-[15px] font-normal text-[#667085] dark:text-[#98A2B3] text-center mt-3">{label}</p>
    </div>
  );
}

