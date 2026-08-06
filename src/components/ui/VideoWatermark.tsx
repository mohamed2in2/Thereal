"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anti-screen-recording forensic watermark.
 *
 * Every 10 seconds the viewer's identifier flashes at a new random position.
 * The flash also triggers a 500ms visual disruption (brief opacity drop on the
 * player wrapper) that interrupts any screen recording at a predictable cadence —
 * making leaked recordings obviously degraded.
 *
 * pointer-events:none so it never blocks player controls.
 */

const VISIBLE_MS  = 10_000; // watermark visible for 10 s …
const CYCLE_MS    = 10_000; // … repeating every 10 s
const DISRUPT_MS  = 500;    // 0.5 s visual disruption
const OPACITY     = 0.22;   // slightly more visible than before

// Keep the label fully on-screen (right-anchored text, dir=ltr).
function randomPos() {
  return { top: `${8 + Math.random() * 74}%`, left: `${6 + Math.random() * 68}%` };
}

export type WatermarkHandle = {
  /** Called by parent player wrapper to connect the disruption callback. */
  onDisrupt: (fn: () => void) => void;
};

interface Props {
  label: string;
  /** Optional callback fired whenever the watermark flashes (for player disruption). */
  onFlash?: () => void;
}

export function VideoWatermark({ label, onFlash }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(randomPos);
  const [motionOk, setMotionOk] = useState(true);
  const onFlashRef = useRef(onFlash);
  onFlashRef.current = onFlash;

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    let hideTimer: ReturnType<typeof setTimeout>;
    const flash = () => {
      setPos(randomPos());
      setVisible(true);
      // Trigger player disruption
      onFlashRef.current?.();
      hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS);
    };

    flash(); // first appearance shortly after load
    const cycle = setInterval(flash, CYCLE_MS);
    return () => {
      clearInterval(cycle);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!label) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-10" aria-hidden>
      <span
        className="absolute font-mono text-[11px] sm:text-sm font-semibold tracking-wider whitespace-nowrap"
        dir="ltr"
        style={{
          top: pos.top,
          left: pos.left,
          color: `rgba(255,255,255,${OPACITY})`,
          textShadow: "0 1px 4px rgba(0,0,0,0.75)",
          opacity: visible ? 1 : 0,
          transition: motionOk ? "opacity 0.4s ease-in-out" : "none",
        }}
      >
        {label}
      </span>
    </div>
  );
}
