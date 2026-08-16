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

/**
 * How long execute() will wait for the Google script before giving up.
 *
 * Submitting faster than the script loads is the common case — a user who
 * autofills and hits enter beats it easily. Returning an empty token there made
 * the server reject the request as "no captcha supplied", so the fix is to wait
 * rather than to weaken the server check.
 */
const READY_TIMEOUT_MS = 8000;

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
  const [isBlocked, setIsBlocked] = useState(false);
  const scriptLoaded = useRef(false);

  /**
   * Deferred that settles true once grecaptcha is usable, false if it never
   * will be. Built in useState's lazy initializer so it is created exactly once
   * without touching a ref during render.
   */
  const [readyGate, setReadyGate] = useState(() => {
    let settle: (usable: boolean) => void = () => {};
    const promise = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    return { promise, settle };
  });

  const loadScript = useCallback(() => {
    const markUsable = () => {
      if (typeof window !== "undefined" && window.grecaptcha?.enterprise) {
        window.grecaptcha.enterprise.ready(() => {
          setReady(true);
          setIsBlocked(false);
          readyGate.settle(true);
        });
      } else {
        setIsBlocked(true);
        readyGate.settle(false);
      }
    };

    // Inject the enterprise script if it isn't already present.
    const existing = document.querySelector(`script[src*="recaptcha/enterprise"]`);
    if (existing) {
      markUsable();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = markUsable;
    // Blocked by an extension, a filtering ISP, or offline — settle rather than
    // leaving every caller waiting for the full timeout.
    script.onerror = () => {
      setIsBlocked(true);
      readyGate.settle(false);
    };
    document.head.appendChild(script);
  }, [readyGate]);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    loadScript();
  }, [loadScript]);

  const retry = useCallback(() => {
    const existing = document.querySelector(`script[src*="recaptcha/enterprise"]`);
    if (existing) existing.remove();
    scriptLoaded.current = false;
    let settle: (usable: boolean) => void = () => {};
    const promise = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    setReadyGate({ promise, settle });
    setIsBlocked(false);
    setReady(false);
  }, []);

  const execute = useCallback(async (action: string): Promise<string> => {
    if (!ready) {
      const usable = await Promise.race([
        readyGate.promise,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), READY_TIMEOUT_MS)),
      ]);
      if (!usable || !window.grecaptcha?.enterprise) {
        setIsBlocked(true);
        console.warn("[reCAPTCHA] Unavailable after waiting; submitting without a token.");
        return "";
      }
    }

    try {
      return await window.grecaptcha.enterprise.execute(SITE_KEY, { action });
    } catch (err) {
      setIsBlocked(true);
      console.error("[reCAPTCHA] execute() failed:", err);
      return "";
    }
  }, [ready, readyGate]);

  return { execute, ready, isBlocked, retry };
}
