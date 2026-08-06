"use client";

import { useEffect, useRef, useState } from "react";

export type PaymentStatusPhase = "idle" | "loading" | "pending" | "success" | "failed" | "error";

interface UsePaymentStatusOptions {
  /** Gateway transaction id to poll for; hook is inert until this is set. */
  transactionId: string | null;
  /** Called exactly once when status first becomes "completed"/"success". */
  onSuccess?: (reference?: string) => void;
  /** Called on terminal failure (gateway reports failed/cancelled/expired). */
  onFailure?: () => void;
  /** Stop conditions and budgets. */
  maxElapsedMs?: number; // default 5 minutes
}

interface PaymentStatusResult {
  phase: PaymentStatusPhase;
  status: string | null;
  reference: string | null;
  error: string | null;
  stop: () => void;
}

const TERMINAL_SUCCESS = new Set(["completed", "success", "paid"]);
const TERMINAL_FAILURE = new Set(["failed", "failure", "cancelled", "canceled", "expired", "rejected"]);

/**
 * Polls the read-only status endpoint with exponential backoff:
 * 2s → 3s → 4.5s → ... → capped at 15s, for up to `maxElapsedMs`.
 * Stops on terminal states, unmount, or explicit stop().
 */
export function usePaymentStatus({
  transactionId,
  onSuccess,
  onFailure,
  maxElapsedMs = 5 * 60 * 1000,
}: UsePaymentStatusOptions): PaymentStatusResult {
  const [phase, setPhase] = useState<PaymentStatusPhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const firedRef = useRef(false);
  const callbacksRef = useRef({ onSuccess, onFailure });
  callbacksRef.current = { onSuccess, onFailure };

  useEffect(() => {
    if (!transactionId) {
      setPhase("idle");
      return;
    }

    stoppedRef.current = false;
    firedRef.current = false;
    setPhase("loading");
    setError(null);
    setStatus(null);
    setReference(null);

    const startedAt = Date.now();
    let delay = 2000;

    const fireSuccess = (ref?: string | null) => {
      if (firedRef.current) return;
      firedRef.current = true;
      callbacksRef.current.onSuccess?.(ref ?? undefined);
    };
    const fireFailure = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      callbacksRef.current.onFailure?.();
    };

    const tick = async () => {
      if (stoppedRef.current) return;

      if (Date.now() - startedAt > maxElapsedMs) {
        setPhase("error");
        setError("انتهت مهلة الانتظار — إذا أتممت الدفع سيصل رصيدك تلقائياً، ويمكنك التحقق من صفحة حسابك لاحقاً.");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/payments/sha7nawy/status?transactionId=${encodeURIComponent(transactionId)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (stoppedRef.current) return;

        if (!res.ok) {
          // 4xx means the transaction isn't readable (not owned, bad id) — stop.
          if (res.status >= 400 && res.status < 500) {
            const body = await res.json().catch(() => ({}));
            setPhase("error");
            setError(body.error || "تعذر التحقق من حالة الدفع");
            return;
          }
          // 5xx: gateway hiccup — keep polling.
          setPhase("pending");
        } else {
          const body = (await res.json()) as { status?: string; reference?: string };
          const st = (body.status ?? "pending").toLowerCase();
          setStatus(st);
          setReference(body.reference ?? null);

          if (TERMINAL_SUCCESS.has(st)) {
            setPhase("success");
            fireSuccess(body.reference);
            return;
          }
          if (TERMINAL_FAILURE.has(st)) {
            setPhase("failed");
            fireFailure();
            return;
          }
          setPhase("pending");
        }
      } catch (err: any) {
        if (stoppedRef.current || err?.name === "AbortError") return;
        // Network error — keep polling, stay in pending.
        setPhase("pending");
      }

      delay = Math.min(Math.round(delay * 1.5), 15000);
      timerRef.current = setTimeout(tick, delay);
    };

    timerRef.current = setTimeout(tick, 500); // first check quickly

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [transactionId, maxElapsedMs]);

  const stop = () => {
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  };

  return { phase, status, reference, error, stop };
}
