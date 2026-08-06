"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

type OrientationLock = ScreenOrientation & {
  lock?: (o: "landscape") => Promise<void>;
  unlock?: () => void;
};

/** Best-effort: rotate to landscape on touch devices (needs real fullscreen). */
async function lockLandscape() {
  try {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    await (screen.orientation as OrientationLock | undefined)?.lock?.("landscape");
  } catch {
    /* unsupported / not in fullscreen — ignore */
  }
}

function unlockOrientation() {
  try {
    (screen.orientation as OrientationLock | undefined)?.unlock?.();
  } catch {
    /* ignore */
  }
}

/**
 * Wrapper-based fullscreen. Cross-origin iframes can't host our DOM overlay in
 * their OWN native fullscreen, so we fullscreen a same-origin wrapper (which
 * contains the watermark) instead.
 *
 * Mobile-robust: the standard `requestFullscreen()` on a <div> is unsupported on
 * iOS Safari and can be blocked on some Android browsers. We try the standard
 * API, then the webkit-prefixed one, and finally fall back to a CSS
 * "pseudo-fullscreen" (position:fixed, fills the viewport) so the control always
 * does something useful. `isFs` is true for either real or CSS fullscreen;
 * `cssFs` tells the player to apply the fixed-overlay styles.
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [cssFs, setCssFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const doc = document as FsDocument;
      const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setNativeFs(!!fsEl && fsEl === ref.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Exiting CSS fullscreen with the back gesture / Escape.
  useEffect(() => {
    if (!cssFs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCssFs(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cssFs]);

  const toggle = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    const doc = document as FsDocument;
    const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    // Currently fullscreen (native or CSS) → exit.
    if (fsEl || cssFs) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      } catch { /* ignore */ }
      unlockOrientation();
      setCssFs(false);
      return;
    }

    // Enter — prefer the real Fullscreen API, fall back to CSS overlay.
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        void lockLandscape();
        return;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        void lockLandscape();
        return;
      }
      throw new Error("Fullscreen API unavailable");
    } catch {
      setCssFs(true);
    }
  }, [cssFs]);

  return { ref, isFs: nativeFs || cssFs, cssFs, toggle };
}
