"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { ErrorState } from "./ErrorState";
import { usePaymentStatus } from "./usePaymentStatus";

/**
 * UI that shows the live polling state after a payment has been created.
 * Single centred 24px spinner, 15px text line, no progress bars or fake stages.
 */
export function PaymentStatus({ transactionId, onSuccess }: { transactionId: string; onSuccess: () => void }) {
  const { phase, error, reference, stop } = usePaymentStatus({ transactionId, onSuccess });
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (phase === "success") {
      success("تم شحن رصيدك بنجاح");
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((phase === "failed" || phase === "error") && error) {
      toastError(error);
    }
  }, [phase, error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div dir="rtl" className="mt-6">
      {phase === "loading" || phase === "pending" ? (
        <div className="flex flex-col items-center justify-center py-8">
          <svg
            aria-hidden
            className="w-6 h-6 animate-spin text-[#047857] dark:text-[#10B981]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <p className="text-[15px] font-normal text-[#667085] dark:text-[#98A2B3] text-center mt-3">
            جاري التحقق من حالة الدفع...
          </p>
        </div>
      ) : phase === "failed" || phase === "error" ? (
        <div className="space-y-3">
          <ErrorState message={error ?? "تعذر التأكد من حالة العملية حالياً."} onRetry={() => stop()} />
        </div>
      ) : phase === "success" ? (
        <div className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-4 text-center">
          <p className="text-[15px] font-normal text-[#101828] dark:text-[#F2F4F7]">
            تمت العملية بنجاح. رقم المرجع: <span className="tabular-nums font-semibold">{reference}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

