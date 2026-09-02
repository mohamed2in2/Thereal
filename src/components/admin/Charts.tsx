"use client";

import { useState } from "react";

/**
 * Lightweight dependency-free SVG charts for the teacher analytics overview.
 * All render LTR internally (time flows left→right) inside a dir="ltr" wrapper,
 * with Arabic labels. Motion respects prefers-reduced-motion.
 */

type SeriesPoint = { date: string; views: number; enrollments: number };

const SKY = "#38bdf8";
const EMERALD = "#34d399";

function niceMax(n: number) {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
}

// ── Area + line: views (area) and enrollments (line) over time ────────────────
export function ViewsAreaChart({ series }: { series: SeriesPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const W = 760, H = 260, padL = 42, padR = 20, padT = 24, padB = 36;
  const n = series.length;
  if (n === 0) return null;

  const maxV = niceMax(Math.max(1, ...series.map((s) => Math.max(s.views, s.enrollments))));
  const x = (i: number) => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => H - padB - (v / maxV) * (H - padT - padB);

  const viewsLine = series.map((s, i) => `${x(i).toFixed(1)},${y(s.views).toFixed(1)}`).join(" ");
  const areaPath = `M ${x(0).toFixed(1)},${(H - padB).toFixed(1)} L ${series
    .map((s, i) => `${x(i).toFixed(1)},${y(s.views).toFixed(1)}`)
    .join(" L ")} L ${x(n - 1).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const enrollLine = series.map((s, i) => `${x(i).toFixed(1)},${y(s.enrollments).toFixed(1)}`).join(" ");

  // Correct ascending Y grid (from bottom 0 to top maxV)
  const fractions = [0, 0.25, 0.5, 0.75, 1];
  const gridY = fractions.map((f) => ({
    gy: H - padB - f * (H - padT - padB),
    val: Math.round(f * maxV),
  }));

  const labelIdx = n <= 7 ? series.map((_, i) => i) : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];

  return (
    <div dir="ltr" className="w-full relative select-none">
      {/* Top Legend Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span>المشاهدات</span>
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>الاشتراكات</span>
          </span>
        </div>

        {hoveredIdx !== null && series[hoveredIdx] && (
          <div className="text-xs font-bold font-mono px-3 py-1 rounded-lg bg-slate-800 text-white border border-slate-700 shadow-md">
            <span>📅 {series[hoveredIdx].date}</span>
            <span className="mx-2 text-slate-500">|</span>
            <span className="text-sky-400">{series[hoveredIdx].views} مشاهدة</span>
            <span className="mx-2 text-slate-500">|</span>
            <span className="text-emerald-400">{series[hoveredIdx].enrollments} اشتراك</span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="مخطط المشاهدات والاشتراكات عبر الزمن">
        <defs>
          <linearGradient id="viewsFillGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal gridlines + Correct Y labels (0 at bottom, maxV at top) */}
        {gridY.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={g.gy}
              x2={W - padR}
              y2={g.gy}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeDasharray={i === 0 ? undefined : "3 3"}
              strokeWidth={i === 0 ? "1.5" : "1"}
            />
            <text
              x={padL - 8}
              y={g.gy + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fill="#94a3b8"
              className="font-mono"
            >
              {g.val}
            </text>
          </g>
        ))}

        {/* Views Area Fill */}
        <path d={areaPath} fill="url(#viewsFillGlow)" className="chart-draw" />

        {/* Views Line */}
        <polyline
          points={viewsLine}
          fill="none"
          stroke={SKY}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Enrollments Line (Dashed) */}
        <polyline
          points={enrollLine}
          fill="none"
          stroke={EMERALD}
          strokeWidth="2.5"
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points for interactive inspection */}
        {series.map((s, i) => {
          const cx = x(i);
          const cy = y(s.views);
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3.5}
                fill={isHovered ? "#ffffff" : SKY}
                stroke="#0f172a"
                strokeWidth="2"
                className="transition-all duration-150"
              />
            </g>
          );
        })}

        {/* X labels (Dates) */}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - padB + 20}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#94a3b8"
            className="font-mono"
          >
            {series[i].date.slice(5)}
          </text>
        ))}
      </svg>

      <style jsx>{`
        .chart-draw { animation: chartFade 0.6s ease-out both; }
        @keyframes chartFade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .chart-draw { animation: none; } }
      `}</style>
    </div>
  );
}

// ── Horizontal bar list (top/low videos, course breakdown) ───────────────────
export function HBarList({
  items, color = SKY, emptyLabel = "لا توجد بيانات",
}: {
  items: { label: string; value: number; sub?: string }[];
  color?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-[var(--ink-muted)] py-6 text-center">{emptyLabel}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--ink)] truncate">{it.label}</span>
              <span className="text-xs font-bold tabular-nums text-[var(--ink-muted)] shrink-0">{it.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, background: color }}
              />
            </div>
            {it.sub && <p className="text-[10px] text-[var(--ink-muted)] mt-1 truncate">{it.sub}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Vertical distribution bars (quiz score buckets) ──────────────────────────
export function DistBars({ buckets, color = "#818cf8" }: { buckets: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (total === 0) return <p className="text-sm text-[var(--ink-muted)] py-6 text-center">لا توجد نتائج اختبارات بعد</p>;
  return (
    <div className="flex items-end justify-between gap-3 h-40 pt-2">
      {buckets.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <span className="text-xs font-bold tabular-nums text-[var(--ink)]">{b.count}</span>
          <div className="w-full rounded-t-lg transition-[height] duration-700" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? 6 : 2, background: b.count > 0 ? color : "var(--border)" }} />
          <span className="text-[10px] text-[var(--ink-muted)] text-center" dir="ltr">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
