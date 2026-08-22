"use client";

import React, { useEffect, useState } from "react";

/**
 * Normal Low-Opacity Drifting Video Watermark.
 *
 * Design & Security Principles:
 * 1. Low Opacity & Distraction-Free: Rendered at very subtle opacity (~12-15%) with a soft
 *    transparent background, ensuring students can focus 100% on the teacher's slides and content.
 * 2. Drifting Anti-Crop Positions: Moves smoothly to random coordinates every 15 seconds with
 *    a gentle 1-second transition, ensuring screen-recorded clips capture the identity without
 *    permitting static cropping or static overlay blurs.
 * 3. Compositing & Hardware DRM Safe: Absolutely positioned sibling overlay with pointer-events: none.
 *    Never adds CSS filters to the underlying <video> or <iframe>, keeping Direct Composition active.
 */

interface VideoWatermarkProps {
  label?: string;
  /** Optional custom opacity (default: 0.14) */
  opacity?: number;
  /** Optional custom change interval in seconds (default: 15) */
  intervalSeconds?: number;
}

function getRandomPosition() {
  // Safe bounds away from playback controls (bottom 20%) and top header (top 8%)
  const top = Math.floor(Math.random() * 65 + 10);
  const left = Math.floor(Math.random() * 65 + 10);
  return { top: `${top}%`, left: `${left}%` };
}

export function VideoWatermark({
  label,
  opacity = 0.14,
  intervalSeconds = 15,
}: VideoWatermarkProps) {
  const [position, setPosition] = useState(getRandomPosition);

  useEffect(() => {
    if (!label) return;

    const interval = setInterval(() => {
      setPosition(getRandomPosition());
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [label, intervalSeconds]);

  if (!label || !label.trim()) return null;

  const displayLabel = label.trim();

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-20"
      aria-hidden
      dir="ltr"
    >
      {/* ── Normal Drifting Floating Watermark Badge ── */}
      <div
        className="absolute transition-all duration-1000 ease-in-out select-none"
        style={{
          top: position.top,
          left: position.left,
          opacity,
        }}
      >
        <div className="font-mono text-[11px] sm:text-xs font-semibold tracking-wider text-white bg-black/25 backdrop-blur-[1px] px-2.5 py-1 rounded border border-white/10 shadow-sm whitespace-nowrap">
          {displayLabel}
        </div>
      </div>
    </div>
  );
}

export default VideoWatermark;
