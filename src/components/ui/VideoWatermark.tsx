"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anti-screen-recording forensic watermark.
 *
 * Every 3 seconds the viewer's identifier moves to a new random position on screen.
 * High contrast with a subtle translucent pill so it is always readable without
 * obscuring the underlying video lesson.
 *
 * pointer-events:none so it never blocks player controls.
 */

const CYCLE_MS = 3_000; // moves every 3 seconds
const VISIBLE_MS = 2_800; // remains active during cycle

function randomPos() {
  // Keep safely within view boundaries
  return {
    top: `${10 + Math.floor(Math.random() * 75)}%`,
    left: `${8 + Math.floor(Math.random() * 70)}%`,
  };
}

interface Props {
  label: string;
  /** Optional callback fired whenever the watermark moves (for player disruption). */
  onFlash?: () => void;
}

export function VideoWatermark({ label, onFlash }: Props) {
  const [visible, setVisible] = useState(true);
  const [pos, setPos] = useState(randomPos);
  const [motionOk, setMotionOk] = useState(true);
  const onFlashRef = useRef(onFlash);
  onFlashRef.current = onFlash;

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const flash = () => {
      setPos(randomPos());
      setVisible(true);
      onFlashRef.current?.();
    };

    flash();
    const cycle = setInterval(flash, CYCLE_MS);
    return () => clearInterval(cycle);
  }, []);

  if (!label) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-10" aria-hidden>
      <span
        className="absolute font-mono text-[11px] sm:text-xs font-bold tracking-widest whitespace-nowrap px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-[1px] border border-white/20 text-white/85 shadow-lg"
        dir="ltr"
        style={{
          top: pos.top,
          left: pos.left,
          textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)",
          opacity: visible ? 0.85 : 0,
          transition: motionOk ? "top 0.4s ease-in-out, left 0.4s ease-in-out, opacity 0.3s ease" : "none",
        }}
      >
        {label}
      </span>
    </div>
  );
}
