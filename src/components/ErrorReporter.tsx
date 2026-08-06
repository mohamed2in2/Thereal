"use client";
import { useEffect } from "react";

const ENDPOINT = "/api/errors/report";

const IGNORE_PATTERNS = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Script error/i,
  /ResizeObserver loop/i,
  // React internal noise — not actionable
  /Warning: /i,
  /hydrat/i,
];

function shouldIgnore(message: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(message));
}

// Simple rate-limit: at most 1 report per 5 seconds per type.
const lastSent: Record<string, number> = {};
const RATE_MS = 5_000;

async function report(
  type: "error" | "unhandled_promise",
  message: string,
  stack?: string
) {
  if (shouldIgnore(message)) return;
  const now = Date.now();
  const key = `${type}:${message.slice(0, 80)}`;
  if (lastSent[key] && now - lastSent[key] < RATE_MS) return; // deduplicate rapid duplicates
  lastSent[key] = now;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        message: message.slice(0, 1000),
        stack: stack?.slice(0, 4000),
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
  } catch { /* reporting must never throw */ }
}

export function ErrorReporter() {
  useEffect(() => {
    // Skip all error collection in development — it floods the API with React
    // hydration warnings and dev-only noise, masking real production errors.
    if (process.env.NODE_ENV !== "production") return;

    // ── window.onerror ──────────────────────────────────────────────────────
    const prevOnError = window.onerror;
    window.onerror = (message, source, _line, _col, error) => {
      void report("error", String(message), error?.stack ?? `@ ${source}`);
      return prevOnError ? prevOnError(message, source, _line, _col, error) : false;
    };

    // ── unhandledrejection ───────────────────────────────────────────────────
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const msg =
        e.reason instanceof Error
          ? e.reason.message
          : String(e.reason ?? "Unhandled promise rejection");
      void report("unhandled_promise", msg, (e.reason as Error)?.stack);
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    // ── console.error only (no warn — warns are dev noise, not prod errors) ──
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      origError(...args);
      const message = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
      const stack   = args.find((a): a is Error => a instanceof Error)?.stack;
      void report("error", message, stack);
    };

    return () => {
      window.onerror = prevOnError;
      window.removeEventListener("unhandledrejection", onUnhandled);
      console.error = origError;
    };
  }, []);

  return null;
}
