"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced position saver. Tracks elapsed playback delta and sends position
 * updates to the server every ~5s of active playback. On unmount, flushes the
 * last known position so navigation mid-video preserves the resume point.
 */
export function usePositionSaver(videoId: string | null) {
  const lastSavedRef = useRef(0);      // last position we sent to server
  const lastSaveTimeRef = useRef(0);    // Date.now() of last save
  const lastReportedRef = useRef(0);    // last currentTime from player
  const pendingDeltaRef = useRef(0);    // accumulated delta since last save
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoIdRef = useRef(videoId);
  videoIdRef.current = videoId;

  // Send position to server
  const flush = useCallback(async () => {
    const vid = videoIdRef.current;
    if (!vid) return;
    const seconds = lastReportedRef.current;
    const delta = pendingDeltaRef.current;
    if (seconds <= 0 && delta <= 0) return;

    // Reset pending delta before the request so concurrent ticks don't double-count
    pendingDeltaRef.current = 0;
    lastSavedRef.current = seconds;
    lastSaveTimeRef.current = Date.now();

    try {
      await fetch(`/api/videos/${vid}/position`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seconds: Math.round(seconds),
          deltaWatchedSeconds: Math.max(0, delta),
        }),
      });
    } catch {
      // Network error — delta is lost, but that's acceptable; server-side
      // watchedSecondsTotal is a best-effort cumulative signal, not a hard gate.
    }
  }, []);

  // Called by the player on each timeupdate (~500ms–1s)
  const reportProgress = useCallback((currentSeconds: number) => {
    const prev = lastReportedRef.current;
    const jump = Math.abs(currentSeconds - prev);

    // If currentTime jumped by more than 2s, it's a seek — don't count the
    // skipped range as watched time.
    if (jump <= 2 && jump > 0) {
      pendingDeltaRef.current += currentSeconds - prev;
    }
    lastReportedRef.current = currentSeconds;
  }, []);

  // 5-second save interval
  useEffect(() => {
    if (!videoId) return;

    lastSavedRef.current = 0;
    lastSaveTimeRef.current = Date.now();
    lastReportedRef.current = 0;
    pendingDeltaRef.current = 0;

    timerRef.current = setInterval(() => {
      if (pendingDeltaRef.current > 0.5 || Math.abs(lastReportedRef.current - lastSavedRef.current) > 2) {
        void flush();
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      // Flush on unmount (navigation away)
      void flush();
    };
  }, [videoId, flush]);

  return { reportProgress };
}
