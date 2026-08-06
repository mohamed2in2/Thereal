"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";
import { getIQData, getIQLevel, LEVEL_COLORS, type IQData } from "@/lib/iq-system";

// ─── Playgrounds/Sandboxes ──────────────────────────────────────────────────
const PLAYGROUNDS = [
  {
    id: "programming/python",
    name: "بيئة Python",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    color: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/20",
    description: "محرر بايثون تفاعلي لتجربة الأكواد البرمجية مباشرة",
    available: true,
  },
  {
    id: "programming/javascript",
    name: "بيئة JavaScript",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    color: "from-amber-400 to-yellow-500",
    shadow: "shadow-yellow-500/20",
    description: "نفذ كود جافا سكريبت وشاهد النتائج في وحدة التحكم",
    available: true,
  },
  {
    id: "programming/html-css-js",
    name: "بيئة الويب (HTML/CSS/JS)",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/20",
    description: "صمم واجهات الويب مباشرة وشاهد المعاينة الحية فوراً",
    available: true,
  },
  {
    id: "iq",
    name: "اختبار الذكاء البرمجي",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    color: "from-purple-500 to-indigo-500",
    shadow: "shadow-purple-500/20",
    description: "قم بتمرين عقلك وحل مشكلات التفكير البرمجي التفاعلية",
    available: true,
  },
];

// ─── Cognitive IQ Games ─────────────────────────────────────────────────────
const GAMES = [
  {
    id: "math",
    name: "الرياضيات",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    color: "from-blue-500 to-cyan-500",
    shadow: "shadow-cyan-500/20",
    description: "ألعاب الحساب السريع وتوصيل الأنماط الرياضية المعقدة",
    available: true,
  },
  {
    id: "physics",
    name: "الفيزياء",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    color: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/20",
    description: "ألعاب توصيل الدوائر الكهربية وقياس الزوايا الفيزيائية",
    available: true,
  },
  {
    id: "chemistry",
    name: "الكيمياء",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/20",
    description: "تحديات تركيب العناصر الكيميائية وحل المعادلات المعملية",
    available: true,
  },
  {
    id: "biology",
    name: "الأحياء",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    color: "from-teal-400 to-emerald-600",
    shadow: "shadow-teal-500/20",
    description: "ألعاب تصنيف الكائنات الحية وتحديات الخلايا والوراثة",
    available: true,
  },
  {
    id: "programming",
    name: "البرمجة",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    color: "from-orange-400 to-red-500",
    shadow: "shadow-orange-500/20",
    description: "حلبة التحدي البرمجي لمهارات المنطق وحل المشكلات",
    available: true,
  },
  {
    id: "languages",
    name: "اللغات",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
    color: "from-rose-400 to-pink-600",
    shadow: "shadow-rose-500/20",
    description: "تحديات مرادفات الكلمات والقواعد اللغوية التفاعلية",
    available: true,
  },
  {
    id: "history",
    name: "التاريخ",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/20",
    description: "بناء الخطوط الزمنية وتوصيل الأحداث التاريخية الهامة",
    available: true,
  },
  {
    id: "geography",
    name: "الجغرافيا",
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    color: "from-indigo-400 to-blue-600",
    shadow: "shadow-indigo-500/20",
    description: "مطابقة الخرائط وأعلام الدول والمعالم الجغرافية الكبرى",
    available: true,
  },
];

export default function EnvironmentsPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [iqData, setIqData] = useState<IQData | null>(null);

  useEffect(() => {
    fetchMeWithRetry(2, 100).then((me) => setUser(me)).catch(() => {});
    setIqData(getIQData());
  }, []);

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen bg-[var(--bg)] transition-colors duration-300 font-sans">
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          
          {/* Hero Section */}
          <motion.div
            className="mb-10 text-center relative z-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs sm:text-sm font-bold mb-4 border border-indigo-500/20 shadow-sm backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>🔬 بيئات التعلم والذكاء التفاعلية</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-800 dark:from-white dark:via-indigo-100 dark:to-indigo-300">
              بيئات التعلم والتحدي
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              انطلق في محررات البرمجة التطويرية أو درّب عقولك واختبر مهاراتك مع ألعاب الذكاء المعرفي
            </p>
          </motion.div>

          {/* IQ Brain Card — Hero Dashboard Banner */}
          {iqData && (() => {
            const level = getIQLevel(iqData.overallIQ);
            const lc = LEVEL_COLORS[level] || LEVEL_COLORS["متوسط"];
            const pct = Math.min(100, Math.max(10, ((iqData.overallIQ - 200) / 1800) * 100));
            return (
              <motion.div
                className="mb-12"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Link href="/environments/iq" className="block group no-underline">
                  <div
                    className="relative rounded-3xl overflow-hidden border border-indigo-500/20 dark:border-indigo-500/15 p-6 sm:p-8 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10"
                    style={{
                      background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 50%, rgba(15,23,42,0.95) 100%)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    {/* Background glow effects */}
                    <div
                      className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-30"
                      style={{ background: lc.color }}
                    />
                    <div
                      className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-[80px] opacity-25"
                      style={{ background: "#6366f1" }}
                    />

                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8">
                      
                      {/* Left Block (RTL right): IQ Score + Avatar Level */}
                      <div className="flex items-center gap-5 shrink-0 text-center sm:text-right w-full lg:w-auto justify-center sm:justify-start">
                        <div className="relative shrink-0 flex items-center justify-center">
                          {(() => {
                            const r = 44;
                            const c = 2 * Math.PI * r;
                            return (
                              <svg width="116" height="116" viewBox="0 0 116 116" className="transform -rotate-90">
                                <circle cx="58" cy="58" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
                                <circle
                                  cx="58"
                                  cy="58"
                                  r={r}
                                  fill="none"
                                  stroke={lc.color}
                                  strokeWidth="9"
                                  strokeDasharray={c}
                                  strokeDashoffset={c - (pct / 100) * c}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-out"
                                />
                              </svg>
                            );
                          })()}
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-white tracking-tight">{iqData.overallIQ}</span>
                            <span className="text-[10px] font-semibold text-gray-400">معدل الذكاء</span>
                          </div>
                        </div>

                        <div>
                          <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-1.5"
                            style={{ background: `${lc.color}20`, color: lc.color, border: `1px solid ${lc.color}40` }}
                          >
                            <span>🧠 {level}</span>
                          </div>
                          <h2 className="text-2xl font-black text-white">معدل الذكاء المعرفي</h2>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                            <span className="flex items-center gap-1">🎯 {iqData.totalGamesPlayed} جلسة</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-400 font-bold">🔥 {iqData.streak.current} يوم مواظبة</span>
                          </div>
                        </div>
                      </div>

                      {/* Center Block: Skills Horizontal Bars */}
                      <div className="flex-1 w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                        <p className="text-xs font-bold text-gray-300 mb-3 flex items-center justify-between">
                          <span>📊 مهارات التفكير التفاعلية</span>
                          <span className="text-[11px] text-indigo-400 font-normal">تحليل آلي</span>
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {(["السرعة", "الذاكرة", "التركيز", "المرونة"] as const).map((label, i) => {
                            const skillKeys = ["speed", "memory", "attention", "flexibility"] as const;
                            const sk = skillKeys[i];
                            const p = Math.min(100, Math.max(15, ((iqData.skills[sk].score - 200) / 1800) * 100));
                            const barColors = [
                              "from-pink-500 to-rose-500",
                              "from-purple-500 to-indigo-500",
                              "from-amber-400 to-orange-500",
                              "from-emerald-400 to-teal-500",
                            ];
                            return (
                              <div key={sk} className="space-y-1">
                                <div className="flex justify-between items-center text-[11px] font-semibold text-gray-300">
                                  <span>{label}</span>
                                  <span className="font-mono text-gray-400">{Math.round(p)}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${barColors[i]} transition-all duration-700`}
                                    style={{ width: `${p}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Block (RTL left): Action CTA */}
                      <div className="shrink-0 w-full sm:w-auto">
                        <div className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-indigo-600/30 group-hover:scale-105">
                          <span>دخول معمل الذكاء</span>
                          <svg className="w-4 h-4 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </div>

                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })()}

          {/* ════════ SECTION 1: DEVELOPER PLAYGROUNDS ════════ */}
          <div className="mb-14">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-lg font-bold">💻</span>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">بيئات التطوير والمحررات البرمجية</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">محررات أكواد تفاعلية تدعم التنفيذ الفوري للمشاريع</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                {PLAYGROUNDS.length} بيئات
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PLAYGROUNDS.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                >
                  <Link href={`/environments/${subject.id}`} className="block h-full group no-underline">
                    <SubjectCard subject={subject} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ════════ SECTION 2: COGNITIVE IQ GAMES ════════ */}
          <div className="mb-14">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-lg font-bold">🎮</span>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">ألعاب التحدي والذكاء المعرفي (IQ)</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ألعاب ذكاء تفاعلية مصممة لرفع مهارات الاستيعاب والسرعة</p>
                </div>
              </div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                {GAMES.length} ألعاب
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {GAMES.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                >
                  <Link href={`/environments/${subject.id}`} className="block h-full group no-underline">
                    <SubjectCard subject={subject} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}

function SubjectCard({ subject }: { subject: any }) {
  return (
    <div
      className="relative p-6 bg-white dark:bg-[#151B2B] rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden transition-all duration-300 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 text-right group flex flex-col justify-between"
      style={{ minHeight: 250 }}
    >
      {/* Top Gradient Glow */}
      <div className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b ${subject.color} opacity-10 dark:opacity-15`} />
      <div
        className={`absolute -top-20 -right-20 w-44 h-44 bg-gradient-to-br ${subject.color} rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-300`}
        style={{ filter: "blur(40px)" }}
      />

      {/* Top Header Row */}
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div
          className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-white shadow-md ${subject.shadow} group-hover:scale-110 transition-transform duration-300`}
        >
          {subject.icon}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-full border border-emerald-500/20">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          متاح الآن
        </div>
      </div>

      {/* Content Row */}
      <div className="relative z-10 mt-auto flex flex-col gap-1.5">
        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {subject.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {subject.description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 pt-4 mt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
        <span>دخول البيئة</span>
        <svg className="w-4 h-4 transform rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </div>

      {/* Bottom Accent Line */}
      <div className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${subject.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
    </div>
  );
}
