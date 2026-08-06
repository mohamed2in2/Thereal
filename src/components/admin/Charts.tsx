"use client";

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
  const W = 760, H = 260, padL = 36, padR = 14, padT = 16, padB = 28;
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

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => H - padB - f * (H - padT - padB));
  const labelIdx = n <= 6 ? series.map((_, i) => i) : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];

  return (
    <div dir="ltr" className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="مخطط المشاهدات والاشتراكات عبر الزمن">
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY} stopOpacity="0.28" />
            <stop offset="100%" stopColor={SKY} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {gridY.map((gy, i) => (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="9" fill="var(--ink-muted)">
              {Math.round((1 - i / 4) * maxV)}
            </text>
          </g>
        ))}

        {/* views area + line */}
        <path d={areaPath} fill="url(#viewsFill)" className="chart-draw" />
        <polyline points={viewsLine} fill="none" stroke={SKY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* enrollments line (dashed) */}
        <polyline points={enrollLine} fill="none" stroke={EMERALD} strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />

        {/* x labels */}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize="9" fill="var(--ink-muted)">
            {series[i].date.slice(5)}
          </text>
        ))}
      </svg>

      <div className="flex items-center gap-4 mt-2 px-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
          <span className="w-3 h-0.5 rounded-full" style={{ background: SKY }} /> المشاهدات
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
          <span className="w-3 h-0.5 rounded-full" style={{ background: EMERALD }} /> الاشتراكات
        </span>
      </div>

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
