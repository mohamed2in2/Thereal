"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";
import {
  getIQData, getIQLevel, SKILL_LABELS, SKILL_COLORS, LEVEL_COLORS, DASHBOARD_SKILLS,
  type IQData, type IQSkillName,
} from "@/lib/iq-system";

/* ─── Mini bar used per skill ────────────────────────────────────────────── */
function SkillCard({ sk, data }: { sk: IQSkillName; data: IQData["skills"][IQSkillName] }) {
  const pct = Math.min(100, Math.max(10, ((data.score - 200) / (2000 - 200)) * 100));
  const lc  = LEVEL_COLORS[data.level] || LEVEL_COLORS["متوسط"];
  return (
    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border" style={{ background: lc.bg, color: lc.color, borderColor: `${lc.color}30` }}>
          {data.level}
        </span>
        <span className="text-sm font-black text-[var(--ink)]">
          {SKILL_LABELS[sk]}
        </span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-black text-[var(--ink)] tracking-tight">
          {data.score.toLocaleString("ar-EG")}
        </span>
        <span className="text-[11px] text-[var(--ink-muted)]">مستوى {Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: SKILL_COLORS[sk] }}
        />
      </div>
    </div>
  );
}

/* ─── Radar-style SVG overview ───────────────────────────────────────────── */
function OverallRing({ iq }: { iq: number }) {
  const pct = Math.min(100, Math.max(10, ((iq - 200) / 1800) * 100));
  const r = 52;
  const c = 2 * Math.PI * r;
  const level = getIQLevel(iq);
  const lc = LEVEL_COLORS[level] || LEVEL_COLORS["متوسط"];
  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <svg width="150" height="150" viewBox="0 0 150 150" className="transform -rotate-90">
        {/* Track */}
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        {/* Fill */}
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke={lc.color}
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-[var(--ink)] tracking-tight">{iq.toLocaleString("ar-EG")}</span>
        <span className="text-xs text-[var(--ink-muted)] font-medium">معدل الذكاء</span>
        <span className="text-xs font-bold mt-0.5 px-2 py-0.5 rounded-full" style={{ background: lc.bg, color: lc.color }}>
          {level}
        </span>
      </div>
    </div>
  );
}

/* ─── Session history sparkline ──────────────────────────────────────────── */
function Sparkline({ sessions }: { sessions: { score: number; date: number }[] }) {
  if (sessions.length < 2) return <p className="text-xs text-center text-[var(--ink-muted)]">العب أكثر لترى تقدمك التراكمي</p>;
  const last10 = sessions.slice(-10);
  const min = Math.min(...last10.map((s) => s.score));
  const max = Math.max(...last10.map((s) => s.score));
  const range = max - min || 1;
  const W = 320, H = 60;
  const pts = last10
    .map((s, i) => {
      const x = (i / (last10.length - 1)) * W;
      const y = H - ((s.score - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" height={H + 10} viewBox={`0 0 ${W} ${H + 10}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      {last10.map((s, i) => {
        const x = (i / (last10.length - 1)) * W;
        const y = H - ((s.score - min) / range) * H;
        return <circle key={i} cx={x} cy={y} r="4" fill="#6366f1" className="transition-transform hover:scale-125" />;
      })}
    </svg>
  );
}

/* ─── Comparison bar ─────────────────────────────────────────────────────── */
function ComparisonBar({ label, you, avg, color }: { label: string; you: number; avg: number; color: string }) {
  const maxVal = Math.max(you, avg, 2000);
  const youPct = (you / maxVal) * 100;
  const avgPct = (avg / maxVal) * 100;
  return (
    <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="flex justify-between items-center mb-1.5 text-xs">
        <span className="font-bold text-[var(--ink)]">{label}</span>
        <span className="text-[var(--ink-muted)]">درجتك: <strong className="text-[var(--ink)]">{you}</strong> | متوسط الطلاب: <strong>{avg}</strong></span>
      </div>
      <div className="relative h-2.5 rounded-full bg-[var(--bg)] overflow-hidden">
        {/* Average marker */}
        <div className="absolute top-0 bottom-0 w-1 bg-amber-400 rounded-full z-10" style={{ left: `${avgPct}%` }} title={`متوسط الطلاب: ${avg}`} />
        {/* Student bar */}
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${youPct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ─── Subject shortcuts ──────────────────────────────────────────────────── */
const SUBJECT_LINKS = [
  { id: "math",      label: "🔢 الرياضيات السريعة",  href: "/environments/math", color: "from-blue-500 to-cyan-500" },
  { id: "languages", label: "🗣️ اللغات والقواعد",     href: "/environments/languages", color: "from-rose-500 to-pink-600" },
  { id: "history",   label: "🏛️ التاريخ والمخططات",    href: "/environments/history", color: "from-amber-500 to-orange-600" },
  { id: "geography", label: "🌍 الجغرافيا والخرائط",  href: "/environments/geography", color: "from-indigo-500 to-blue-600" },
  { id: "biology",   label: "🔬 الأحياء والخلايا",    href: "/environments/biology", color: "from-emerald-500 to-teal-600" },
  { id: "physics",   label: "⚡ الفيزياء الكهربية",   href: "/environments/physics", color: "from-purple-500 to-indigo-600" },
];

/* ─── Platform averages ─── */
const PLATFORM_AVG: Record<IQSkillName, number> = {
  speed: 1050, memory: 1020, attention: 980, flexibility: 970,
  linguistic: 1010, logical: 1040, spatial: 990, problemsolving: 1030,
};

/* ─── Page Component ─────────────────────────────────────────────────────── */
export default function IQDashboardPage() {
  const [user, setUser]     = useState<MeUser | null>(null);
  const [iqData, setIqData] = useState<IQData | null>(null);
  const [tab, setTab]       = useState<"perf" | "progress">("perf");
  const [stats, setStats]   = useState<{
    rank: number;
    totalRanked: number;
    averageIQ: number;
    studentCount: number;
    isAdaptive: boolean;
    rankingPeriod: string;
  } | null>(null);

  useEffect(() => {
    fetchMeWithRetry(2, 100).then((me) => setUser(me)).catch(() => {});
    setIqData(getIQData());
    const sync = () => setIqData(getIQData());
    window.addEventListener("storage", sync);

    fetch("/api/student/iq")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.rank === "number") {
          setStats({
            rank: data.rank,
            totalRanked: data.totalRanked,
            averageIQ: data.averageIQ,
            studentCount: data.studentCount,
            isAdaptive: data.isAdaptive,
            rankingPeriod: data.rankingPeriod,
          });
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("storage", sync);
  }, []);

  const iq = iqData ?? null;

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen bg-[var(--bg)] transition-colors duration-300 font-sans">
        <Navbar user={user ? { name: user.name, role: user.role } : null} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          
          {/* Top Breadcrumb & Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link href="/environments" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-2">
                <svg className="w-4 h-4 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                العودة إلى بيئات التعلم
              </Link>
              <h1 className="text-3xl font-black text-[var(--ink)] tracking-tight">معدلي | تحليل الذكاء المعرفي</h1>
              <p className="text-sm text-[var(--ink-muted)] mt-1">لوحة التقييم والتحليل التراكمي لمهارات التفكير والسرعة</p>
            </div>

            {/* Segmented Tab Controls */}
            <div className="flex p-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] w-full md:w-auto self-start">
              {([["perf", "📊 الأداء العام"], ["progress", "📈 التطور والتأثير"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    tab === id
                      ? "bg-[var(--surface)] text-[var(--brand)] shadow-sm"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── PERFORMANCE TAB ── */}
          {tab === "perf" && iq && (
            <div className="space-y-8">
              
              {/* Top Overview Cards (Grid 2 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Overall Gauge Card */}
                <div className="lg:col-span-1 p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-3">
                    🧠 التقييم التراكمي الموحد
                  </span>
                  <OverallRing iq={iq.overallIQ} />
                  <p className="text-xs text-[var(--ink-muted)] mt-4 leading-relaxed max-w-xs">
                    معدل مستمد من الدقة، سرعة الاستجابة، ونقاط التحدي اليومية
                  </p>
                </div>

                {/* Rank & Stats Card */}
                <div className="lg:col-span-2 p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
                    <div>
                      <h2 className="text-lg font-black text-[var(--ink)]">الترتيب والإحصائيات الحية</h2>
                      <p className="text-xs text-[var(--ink-muted)]">مقارنتك بالمتوسط العام لطلاب المنصة</p>
                    </div>
                    {stats && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        #{stats.rank} من {stats.totalRanked.toLocaleString("ar-EG")} طالب
                      </span>
                    )}
                  </div>

                  {/* 3 Metric Boxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center">
                      <span className="text-xs text-[var(--ink-muted)] block mb-1">جلسات التحدي</span>
                      <span className="text-2xl font-black text-[var(--ink)]">{iq.totalGamesPlayed.toLocaleString("ar-EG")}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center">
                      <span className="text-xs text-[var(--ink-muted)] block mb-1">سلسلة المواظبة</span>
                      <span className="text-2xl font-black text-amber-500">🔥 {iq.streak.current} يوم</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center">
                      <span className="text-xs text-[var(--ink-muted)] block mb-1">أفضل streak</span>
                      <span className="text-2xl font-black text-indigo-500">⭐ {iq.streak.best} يوم</span>
                    </div>
                  </div>

                  {/* Platform Average Banner */}
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">متوسط ذكاء طلاب المنصة:</span>
                    <span className="font-black text-indigo-700 dark:text-indigo-300 text-sm">{(stats?.averageIQ ?? 1050).toLocaleString("ar-EG")} درجة</span>
                  </div>
                </div>

              </div>

              {/* Skills Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-[var(--ink)]">تفصيل مهارات التفكير والمعرفة</h2>
                  <span className="text-xs text-[var(--ink-muted)]">محدث تلقائياً مع كل لعبة</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DASHBOARD_SKILLS.map((sk) => (
                    <SkillCard key={sk} sk={sk} data={iq.skills[sk]} />
                  ))}
                  {iq.skills.spatial.sessions.length > 0 && (
                    <SkillCard sk="spatial" data={iq.skills.spatial} />
                  )}
                </div>
              </div>

              {/* Comparison Section */}
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-lg font-black text-[var(--ink)]">مقارنة بأداء طلاب المنصة</h2>
                    <p className="text-xs text-[var(--ink-muted)]">الخط الأصفر يمثل متوسط الطلاب في كل مهارة</p>
                  </div>
                  <span className="text-xs font-semibold text-[var(--ink-muted)]">
                    {stats ? `بناءً على ${stats.totalRanked.toLocaleString("ar-EG")} طالب` : "مقارنة حية"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DASHBOARD_SKILLS.slice(0, 4).map((sk) => (
                    <ComparisonBar
                      key={sk}
                      label={SKILL_LABELS[sk]}
                      you={iq.skills[sk].score}
                      avg={stats?.averageIQ ?? PLATFORM_AVG[sk]}
                      color={SKILL_COLORS[sk]}
                    />
                  ))}
                </div>
              </div>

              {/* Quick Play Shortcuts */}
              <div>
                <h2 className="text-lg font-black text-[var(--ink)] mb-3">العب الآن لتحسين معدلك</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {SUBJECT_LINKS.map((s) => (
                    <Link
                      key={s.id}
                      href={s.href}
                      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-indigo-500/40 text-center font-bold text-xs text-[var(--ink)] shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group no-underline"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">{s.label.split(" ")[0]}</span>
                      <span>{s.label.split(" ").slice(1).join(" ")}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── PROGRESS TAB ── */}
          {tab === "progress" && iq && (
            <div className="space-y-8">
              
              {/* Overall trend */}
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <h2 className="text-lg font-black text-[var(--ink)] mb-4">📈 مسار التطور والتغير في الأداء</h2>
                
                {iq.totalGamesPlayed === 0 ? (
                  <div className="py-12 text-center text-[var(--ink-muted)]">
                    <div className="text-4xl mb-2">🎮</div>
                    <p className="text-sm font-bold text-[var(--ink)]">لم تلعب أي ألعاب بعد</p>
                    <p className="text-xs mt-1">ابدأ باللعب الآن لتسجيل نقاط التطور الأولى</p>
                    <Link
                      href="/environments"
                      className="inline-block mt-4 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md no-underline"
                    >
                      ابدأ التحدي الأول
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-xs text-[var(--ink-muted)]">
                      <span>آخر تحديث: {iq.lastUpdated ? new Date(iq.lastUpdated).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) : "اليوم"}</span>
                      <span className="font-mono font-bold text-[var(--ink)]">IQ: {iq.overallIQ}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {DASHBOARD_SKILLS.map((sk) => {
                        const sessions = iq.skills[sk].sessions;
                        if (sessions.length < 2) return null;
                        const first = sessions[0].score;
                        const last = sessions[sessions.length - 1].score;
                        const delta = last - first;
                        return (
                          <div key={sk} className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-[var(--ink)]">{SKILL_LABELS[sk]}</span>
                              <span className={`text-xs font-bold ${delta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {delta >= 0 ? "+" : ""}{delta} {delta >= 0 ? "↑" : "↓"}
                              </span>
                            </div>
                            <Sparkline sessions={sessions} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Per-subject breakdown */}
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <h2 className="text-lg font-black text-[var(--ink)] mb-4">📚 تفصيل الأداء حسب المواد</h2>
                <div className="divide-y divide-[var(--border)]">
                  {SUBJECT_LINKS.map((s) => {
                    const subjectSessions = Object.values(iq.skills).flatMap((skill) =>
                      skill.sessions.filter((sess) => sess.subject === s.id)
                    );
                    const count = subjectSessions.length;
                    if (count === 0) {
                      return (
                        <div key={s.id} className="flex items-center justify-between py-3 text-xs text-[var(--ink-muted)]">
                          <span className="font-bold text-[var(--ink)]">{s.label}</span>
                          <span className="italic">لم تلعب بعد</span>
                        </div>
                      );
                    }
                    const avgScore = Math.round(subjectSessions.reduce((a, b) => a + b.score, 0) / count);
                    return (
                      <Link
                        key={s.id}
                        href={s.href}
                        className="flex items-center justify-between py-3 text-xs hover:bg-[var(--surface-2)] px-2 rounded-xl transition-colors no-underline"
                      >
                        <span className="font-bold text-[var(--ink)]">{s.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{count} جلسة</span>
                          <span className="text-[var(--ink-muted)]">•</span>
                          <span className="font-mono font-bold text-[var(--ink)]">متوسط {avgScore.toLocaleString("ar-EG")}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
