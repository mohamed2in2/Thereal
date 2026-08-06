"use client";

import { MotionConfig, motion } from "framer-motion";
import { useCountUp } from "@/lib/motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const STATS = [
  { value: 5000, suffix: "+", label: "طالب نشط", glow: "group-hover:text-indigo-300", bar: "bg-indigo-500" },
  { value: 200, suffix: "+", label: "كورس متاح", glow: "group-hover:text-cyan-300", bar: "bg-cyan-500" },
  { value: 50, suffix: "+", label: "مدرس متميز", glow: "group-hover:text-fuchsia-300", bar: "bg-fuchsia-500" },
  { value: 98, suffix: "٪", label: "نسبة الرضا", glow: "group-hover:text-emerald-300", bar: "bg-emerald-500" },
];

const MARQUEE_ITEMS = [
  "رياضيات",
  "فيزياء",
  "كيمياء",
  "أحياء",
  "لغة عربية",
  "لغة إنجليزية",
  "برمجة",
  "اختبارات يومية",
  "متابعة ذكية",
];

function StatCell({ value, suffix, label, glow, bar }: (typeof STATS)[number]) {
  const ref = useCountUp(value, suffix);
  const finalText = value.toLocaleString("ar-EG", { useGrouping: false }) + suffix;

  return (
    <div className="group relative flex flex-col items-center gap-2 py-8 md:py-10">
      <span
        ref={ref}
        aria-label={finalText}
        className={`text-4xl md:text-5xl font-black text-white tabular-nums tracking-tight transition-colors duration-300 ${glow}`}
      >
        {finalText}
      </span>
      <span className="text-sm md:text-base font-medium text-white/50 group-hover:text-white/80 transition-colors duration-300">
        {label}
      </span>
      <span
        aria-hidden
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-0 rounded-full ${bar} opacity-70 transition-all duration-500 group-hover:w-12`}
      />
    </div>
  );
}

export function StatsSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative z-10 bg-[#0B0F19] py-14 md:py-20 border-t border-white/5 overflow-hidden">
        <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl shadow-black/30"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-white/5">
              {STATS.map((stat) => (
                <StatCell key={stat.label} {...stat} />
              ))}
            </div>
          </motion.div>

          <div
            aria-hidden
            dir="ltr"
            className="mt-10 md:mt-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]"
          >
            <div className="flex w-max gap-10 motion-safe:animate-[marquee_46s_linear_infinite] hover:[animation-play-state:paused]">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center gap-10">
                  {MARQUEE_ITEMS.map((item) => (
                    <span key={item} className="flex items-center gap-10 text-sm md:text-base font-bold text-white/25 whitespace-nowrap">
                      {item}
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
