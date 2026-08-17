"use client";

/**
 * Inline error panel with friendly Arabic copy, retry button, and WhatsApp link.
 * Never displays raw gateway error strings to students.
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  onSelectMethod?: (methodId: string) => void;
  itemName?: string;
  amount?: number | string;
  userName?: string;
}

/**
 * Premium Egyptian EdTech Error Panel with friendly Arabic copy,
 * instant 1-click alternative payment options (InstaPay, Fawry),
 * and direct WhatsApp support with prefilled context.
 */
export function ErrorState({
  message,
  onRetry,
  onSelectMethod,
  itemName,
  amount,
  userName,
}: ErrorStateProps) {
  const isRawGatewayError =
    !message ||
    message.includes("{") ||
    message.includes("}") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET") ||
    message.includes("Timeout") ||
    message.includes("Internal Server Error") ||
    message.includes("Unhandled Runtime Error") ||
    message.toLowerCase().includes("provider error");

  const friendlyMessage = isRawGatewayError
    ? "خدمة الخصم التلقائي للمحفظة تواجه صيانة مؤقتة لدى شبكة الاتصالات حالياً. يمكنك استخدام وسيلة دفع بديلة مثل إنستاباي أو فوري لتفعيل طلبك فوراً."
    : message;

  const whatsappPhone = "+201118802621";
  const waText = encodeURIComponent(
    `السلام عليكم، أود المساعدة في إتمام عملية السداد على منصة Code-UP.\n` +
    (userName ? `👤 اسم الطالب: ${userName}\n` : "") +
    (itemName ? `📚 المحتوى: ${itemName}\n` : "") +
    (amount ? `💰 المبلغ: ${amount} جنيه\n` : "") +
    `⚠️ المشكلة: تعذر الدفع عبر المحفظة الإلكترونية وأريد تفعيل الحساب.`
  );

  return (
    <div
      dir="rtl"
      className="rounded-2xl border border-rose-500/20 bg-white dark:bg-[#141A21] p-5 sm:p-6 shadow-sm space-y-5 animate-fadeIn"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            aria-hidden
            className="w-5 h-5"
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
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold text-rose-700 dark:text-rose-400">
            تنبيه أثناء إتمام العملية
          </h3>
          <p className="text-[14px] text-[#475467] dark:text-[#98A2B3] mt-1 leading-[1.6]">
            {friendlyMessage}
          </p>
        </div>
      </div>

      {/* Recommended Alternative Methods */}
      {onSelectMethod && (
        <div className="pt-3 border-t border-[#E4E7EC] dark:border-[#232C36] space-y-2.5">
          <p className="text-xs font-bold text-[#344054] dark:text-[#D0D5DD]">
            🚀 اختر وسيلة دفع بديلة تعمل الآن فوراً وبأمان:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onSelectMethod("instapay")}
              className="px-4 py-3 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-900 dark:text-purple-200 font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                  IPN
                </span>
                <span>إنستاباي (InstaPay)</span>
              </div>
              <span className="text-[11px] font-normal text-purple-700 dark:text-purple-300">
                بدون رسوم ⚡
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectMethod("fawry")}
              className="px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#FFC20E] text-black flex items-center justify-center text-[10px] font-black">
                  FAW
                </span>
                <span>فوري (Fawry Pay)</span>
              </div>
              <span className="text-[11px] font-normal text-amber-700 dark:text-amber-300">
                كود سداد كاش 🧾
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-3 border-t border-[#E4E7EC] dark:border-[#232C36] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-10 px-4 rounded-xl border border-[#D0D5DD] dark:border-[#344054] bg-[#F8F9FA] dark:bg-[#1E293B] text-[13px] sm:text-[14px] font-bold text-[#101828] dark:text-[#F2F4F7] hover:bg-[#E4E7EC] dark:hover:bg-[#334155] transition-colors cursor-pointer min-h-[44px]"
            >
              ← العودة وتعديل البيانات
            </button>
          )}
        </div>

        <a
          href={`https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 px-4 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-[13px] sm:text-[14px] font-bold transition-all shadow-sm inline-flex items-center gap-1.5 min-h-[44px] no-underline"
        >
          <span>تواصل مع الدعم عبر واتساب 💬</span>
        </a>
      </div>
    </div>
  );
}

