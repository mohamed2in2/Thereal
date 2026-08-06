"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { usePaymentStatus } from "./usePaymentStatus";

/**
 * UI that shows the live polling state after a payment has been created.
 * It drives the wizard's final step: pending → success → automatic redirect.
 */
export function PaymentStatus({ transactionId, onSuccess }: { transactionId: string; onSuccess: () => void }) {
  const { phase, status, error, reference, stop } = usePaymentStatus({ transactionId, onSuccess });
  const { success, error: toastError } = useToast();

  // Fire notifications only when the phase *changes* to a terminal state.
  // Using useEffect keeps side effects out of the render cycle.
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
    <div className="mt-6">
      {phase === "loading" || phase === "pending" ? (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <svg className="h-5 w-5 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
            <path d="M4 12a8 8 0 018-8" />
          </svg>
          <span>جاري التحقق من حالة الدفع …</span>
        </div>
      ) : phase === "failed" || phase === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <p className="font-medium">{error ?? "حدث خطأ غير متوقع"}</p>
          <Button variant="secondary" size="sm" onClick={() => stop()} className="mt-3">
            إيقاف المتابعة
          </Button>
        </div>
      ) : phase === "success" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">تم شحن رصيدك بنجاح! المرجع: {reference}</p>
        </div>
      ) : null}
    </div>
  );
}
