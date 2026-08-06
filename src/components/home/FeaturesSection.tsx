"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─── UI Snippet: Video Player ─────────────────────────────────────────────── */
function VideoMockup() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden shadow-xl flex flex-col"
      style={{ background: "rgba(20,25,35,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div
        className="h-7 flex items-center px-3 gap-1.5 shrink-0"
        style={{ background: "rgba(11,15,25,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-2 h-2 rounded-full bg-red-400/60" />
        <div className="w-2 h-2 rounded-full bg-amber-400/60" />
        <div className="w-2 h-2 rounded-full bg-green-400/60" />
      </div>
      <div className="flex-1 flex items-center justify-center relative aspect-video" style={{ background: "rgba(11,15,25,0.4)" }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="#10B981" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
            <polygon points="5,3 19,12 5,21" fill="#10B981" />
          </svg>
        </div>
        <div className="absolute bottom-3 inset-x-3 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="w-[38%] h-full rounded-full" style={{ background: "linear-gradient(to left, #10B981, #14B8A6)" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── UI Snippet: Quiz with options ────────────────────────────────────────── */
function QuizMockup() {
  const options = [
    { letter: "أ", width: 64, selected: false },
    { letter: "ب", width: 96, selected: true },
    { letter: "ج", width: 72, selected: false },
    { letter: "د", width: 56, selected: false },
  ];
  return (
    <div className="space-y-2 mt-5">
      {options.map((opt) => (
        <div
          key={opt.letter}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            border: `1px solid ${opt.selected ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.08)"}`,
            background: opt.selected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
            color: opt.selected ? "#10B981" : "rgba(148,163,184,0.7)",
          }}
        >
          <span
            className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0"
            style={{ borderColor: opt.selected ? "#10B981" : "rgba(255,255,255,0.15)" }}
          >{opt.letter}</span>
          <div className="h-1.5 rounded-full" style={{ width: opt.width, background: opt.selected ? "#10B981" : "rgba(255,255,255,0.08)" }} />
          {opt.selected && (
            <svg className="w-4 h-4 mr-auto" fill="none" viewBox="0 0 24 24" stroke="#10B981" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      ))}
      {/* Progress bar */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>التقدم</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="w-[65%] h-full rounded-full" style={{ background: "linear-gradient(to left, #10B981, #14B8A6)" }} />
        </div>
        <span className="text-[10px] font-semibold" style={{ color: "#10B981" }}>٦٥٪</span>
      </div>
    </div>
  );
}

/* ─── UI Snippet: AI Chat ──────────────────────────────────────────────────── */
function AIChatMockup() {
  return (
    <div className="space-y-2.5 mt-5">
      {/* User bubble */}
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
        >
          ازاي أبدأ مشروع برمجة بلغة Python؟
        </div>
      </div>
      {/* AI bubble */}
      <div className="flex justify-start">
        <div
          className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }}
        >
          ابدأ بتثبيت Python وبيئة التطوير VS Code، ثم أنشئ ملف main.py واكتب أول سطر...
        </div>
      </div>
      {/* Typing indicator */}
      <div className="flex justify-start">
        <div className="flex items-center gap-1 px-3 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: "200ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── UI Snippet: Stats Bar Chart ──────────────────────────────────────────── */
function StatsMockup() {
  const bars = [
    { h: 45, label: "س" },
    { h: 72, label: "أ" },
    { h: 55, label: "ث" },
    { h: 88, label: "أ" },
    { h: 62, label: "خ" },
    { h: 95, label: "ج" },
    { h: 70, label: "س" },
  ];
  return (
    <div className="mt-5">
      {/* Header row */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-semibold" style={{ color: "#94A3B8" }}>معدل الأداء الأسبوعي</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>+١٢٪</span>
      </div>
      {/* Chart */}
      <div className="flex items-end gap-2 h-24">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${b.h}%`,
                background: b.h >= 85
                  ? "linear-gradient(to top, #10B981, #14B8A6)"
                  : "rgba(16,185,129,0.2)",
                borderTop: b.h >= 85 ? "none" : "1px solid rgba(16,185,129,0.4)",
              }}
            />
            <span className="text-[9px]" style={{ color: "rgba(148,163,184,0.5)" }}>{b.label}</span>
          </div>
        ))}
      </div>
      {/* Attendance row */}
      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} />
        <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>المواظبة</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="w-[82%] h-full rounded-full" style={{ background: "linear-gradient(to left, #F59E0B, #FBBF24)" }} />
        </div>
        <span className="text-[10px] font-bold" style={{ color: "#F59E0B" }}>٨٢٪</span>
      </div>
    </div>
  );
}

/* ─── Feature definitions ──────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "محاضرات فيديو عالية الجودة",
    body: "دروس مسجلة من أفضل المعلمين، منظمة في مسارات واضحة تناسب كل صف دراسي.",
    snippet: <VideoMockup />,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: "اختبارات تفاعلية ذكية",
    body: "أسئلة تفاعلية تُقيّم مستواك الفعلي وتحدد نقاط ضعفك فوراً.",
    snippet: <QuizMockup />,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "مرشد أكاديمي بالذكاء الاصطناعي",
    body: "يحلل تقدمك ويقترح المسار الأفضل والإجابات الفورية على أسئلتك.",
    snippet: <AIChatMockup />,
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "تحليلات الأداء والمواظبة",
    body: "إحصائيات بصرية تُريك نقاط قوتك والمواضيع التي تحتاج مراجعة.",
    snippet: <StatsMockup />,
  },
];

/* ─── Section ──────────────────────────────────────────────────────────────── */
export function FeaturesSection() {
  const reduced = useReducedMotion();

  return (
    <section
      className="py-20 md:py-32 relative border-t overflow-hidden"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none"
        aria-hidden
        style={{ background: "rgba(14,110,98,.08)" }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section header */}
        <div className="mb-14 md:mb-20">
          <h2
            className="text-balance text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4"
            style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}
          >
            لماذا{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(to left, #14B8A6, #10B981)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Code-UP
            </span>
            ؟
          </h2>
          <p className="text-base md:text-lg max-w-xl font-medium leading-relaxed text-pretty" style={{ color: "var(--ink-2)" }}>
            بنيناها لطلاب الثانوية المصرية — كل ميزة تخدم هدفاً واحداً: تسهيل المذاكرة.
          </p>
        </div>

        {/* 2x2 frosted glass feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((feature, idx) => (
            <FeatureCard key={idx} reduced={!!reduced}>
              <div className="flex flex-col h-full">
                {/* Glowing icon header */}
                <IconBox>{feature.icon}</IconBox>
                <h3 className="font-bold text-lg md:text-xl mb-2 tracking-tight" style={{ color: "var(--ink)" }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {feature.body}
                </p>
                {/* Interactive UI snippet inside card */}
                {feature.snippet}
              </div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Glowing Icon Box ─────────────────────────────────────────────────────── */
function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative"
      style={{
        background: "rgba(16,185,129,0.1)",
        border: "1px solid rgba(16,185,129,0.3)",
        color: "#10B981",
        boxShadow: "0 0 20px rgba(16,185,129,0.15)",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Frosted Glass Feature Card ───────────────────────────────────────────── */
function FeatureCard({
  children, reduced, className = "",
}: {
  children: React.ReactNode; reduced: boolean; className?: string;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: EASE }}
      className={`feature-card-frosted relative rounded-2xl p-6 md:p-8 transition-all duration-300 ${className}`}
      style={{
        background: "var(--feature-card-bg, var(--surface))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--feature-card-border, var(--border))",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(20,184,166,0.3)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(16,185,129,0.08), var(--shadow-sm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--feature-card-border, var(--border))";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      {children}
    </motion.div>
  );
}
