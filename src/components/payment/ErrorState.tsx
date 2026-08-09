"use client";

/**
 * Inline error panel with friendly Arabic copy, retry button, and WhatsApp link.
 * Never displays raw gateway error strings to students.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const isRawGatewayError =
    !message ||
    message.includes("{") ||
    message.includes("}") ||
    message.includes("ENOTFOUND") ||
    message.includes("Internal Server Error") ||
    message.includes("Unhandled Runtime Error");

  const friendlyMessage = isRawGatewayError
    ? "تعذر إتمام عملية الدفع الإلكتروني حالياً. يرجى تكرار المحاولة أو التواصل معنا عبر الواتساب."
    : message;

  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-4 shadow-sm space-y-3"
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden
          className="w-5 h-5 text-[#B42318] dark:text-[#F04438] shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-normal text-[#B42318] dark:text-[#F04438] leading-[1.6]">
            {friendlyMessage}
          </p>
          <div className="flex items-center gap-4 flex-wrap mt-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="h-10 px-4 rounded-xl border border-[#E4E7EC] dark:border-[#232C36] text-[15px] font-medium text-[#101828] dark:text-[#F2F4F7] hover:bg-[#E4E7EC]/30 dark:hover:bg-[#232C36]/30 transition-colors"
              >
                إعادة المحاولة
              </button>
            )}
            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_PAYMENT_ACCESS_PASSWORD || "+201285353604").replace(/\D/g, "")}?text=${encodeURIComponent("السلام عليكم، أود المساعدة في إتمام عملية الدفع والشحن على منصة Code-UP")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] font-medium text-[#047857] dark:text-[#10B981] underline min-h-[44px] inline-flex items-center"
            >
              تواصل معنا عبر الواتساب 💬
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

