"use client";

/**
 * useRecaptcha — React hook for reCAPTCHA Enterprise (v3 / invisible).
 *
 * Loads the enterprise script once and exposes an `execute(action)` helper
 * that returns a token to send to your API route for server-side verification.
 *
 * Usage:
 *   const { execute, ready } = useRecaptcha();
 *   const token = await execute("login");
 *   // send token to your API …
 */

import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "6LcJ2xUtAAAAAI4MhIos69DhEOTNN17K-QXmoIXr";

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

export function useRecaptcha() {
  const [ready, setReady] = useState(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    // Inject the enterprise script if it isn't already present.
    const existing = document.querySelector(`script[src*="recaptcha/enterprise"]`);
    if (existing) {
      initWhenReady();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = initWhenReady;
    document.head.appendChild(script);
  }, []);

  function initWhenReady() {
    if (typeof window !== "undefined" && window.grecaptcha?.enterprise) {
      window.grecaptcha.enterprise.ready(() => setReady(true));
    }
  }

  const execute = useCallback(
    async (action: string): Promise<string> => {
      if (!ready || !window.grecaptcha?.enterprise) {
        console.warn("[reCAPTCHA] Not ready yet, skipping token generation.");
        return "";
      }
      try {
        return await window.grecaptcha.enterprise.execute(SITE_KEY, { action });
      } catch (err) {
        console.error("[reCAPTCHA] execute() failed:", err);
        return "";
      }
    },
    [ready]
  );

  return { execute, ready };
}
