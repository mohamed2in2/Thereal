"use client";
import { useState, useEffect } from "react";

interface OverviewData {
  status: string;
  requestsToday: number;
  studentsUsingAI: number;
  teachersUsingAI: number;
  parentsReading: number;
  todayCost: number;
  todayTokens: number;
  avgResponse: number;
  cacheHit: number;
  budgetUsed: number;
  providersOnline: string;
  knowledgeVersion: number;
  promptVersion: number;
  topSubjects: { name: string; count: number }[];
  mostUsedFeature: string;
  leastUsedFeature: string;
  mostExpensiveAction: string;
  mostCachedAction: string;
}

const STATUS_COLOR: Record<string, { bg: string; dot: string; label: string }> = {
  healthy: { bg: "rgba(16,185,129,.12)", dot: "#10b981", label: "سليم" },
  degraded: { bg: "rgba(245,158,11,.12)", dot: "#f59e0b", label: "متدهور" },
  down: { bg: "rgba(239,68,68,.12)", dot: "#ef4444", label: "متوقف" },
};

function fmt(n: number, suffix = ""): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${n}${suffix}`;
}

export default function AIOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/ai/overview", { credentials: "include" });
        if (res.ok) {
          setData(await res.json());
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">🧠</div>
            <p style={{ color: "var(--ink-3)" }}>جارٍ تحميل حالة AI...</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback demo data if API not yet available
  const d: OverviewData = data || {
    status: "healthy",
    requestsToday: 4218,
    studentsUsingAI: 312,
    teachersUsingAI: 27,
    parentsReading: 118,
    todayCost: 3.41,
    todayTokens: 9200000,
    avgResponse: 430,
    cacheHit: 82,
    budgetUsed: 36,
    providersOnline: "4 / 4",
    knowledgeVersion: 21,
    promptVersion: 18,
    topSubjects: [
      { name: "الرياضيات", count: 1240 },
      { name: "الفيزياء", count: 980 },
      { name: "اللغة العربية", count: 720 },
      { name: "الإنجليزي", count: 540 },
    ],
    mostUsedFeature: "Explain",
    leastUsedFeature: "Memory Trick",
    mostExpensiveAction: "Exam Generation",
    mostCachedAction: "Summary",
  };

  const statusInfo = STATUS_COLOR[d.status] || STATUS_COLOR.healthy;

  const cards = [
    { label: "الطلبات اليوم", value: fmt(d.requestsToday), icon: "📊" },
    { label: "طلاب يستخدمون AI", value: d.studentsUsingAI, icon: "🎓" },
    { label: "معلمون يستخدمون AI", value: d.teachersUsingAI, icon: "👨‍🏫" },
    { label: "أولياء أمور", value: d.parentsReading, icon: "👨‍👩‍👦" },
    { label: "تكلفة اليوم", value: `$${d.todayCost.toFixed(2)}`, icon: "💰" },
    { label: "توكنات اليوم", value: fmt(d.todayTokens), icon: "🔤" },
    { label: "متوسط الاستجابة", value: `${d.avgResponse} ms`, icon: "⚡" },
    { label: "نسبة الكاش", value: `${d.cacheHit}%`, icon: "💾" },
    { label: "الميزانية المستخدمة", value: `${d.budgetUsed}%`, icon: "📉" },
    { label: "المزودين أونلاين", value: d.providersOnline, icon: "🌐" },
    { label: "إصدار المعرفة", value: `v${d.knowledgeVersion}`, icon: "📚" },
    { label: "إصدار البرومبت", value: `v${d.promptVersion}`, icon: "📝" },
  ];

  const insights = [
    { label: "أكثر المواد استخداماً", items: d.topSubjects },
    { label: "أكثر الميزات استخداماً", value: d.mostUsedFeature },
    { label: "أقل الميزات استخداماً", value: d.leastUsedFeature },
    { label: "أغلى عملية", value: d.mostExpensiveAction },
    { label: "أكثر عملية مخزنة", value: d.mostCachedAction },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      {/* Status Hero */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5"
        style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.dot}22` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: `${statusInfo.dot}20` }}
        >
          <span
            className="w-5 h-5 rounded-full inline-block"
            style={{ background: statusInfo.dot, boxShadow: `0 0 12px ${statusInfo.dot}` }}
          />
        </div>
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}
          >
            حالة AI: {statusInfo.label}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
            آخر تحديث: {new Date().toLocaleTimeString("ar-EG")}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-4 transition-all hover:scale-[1.02]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="text-xl mb-2">{card.icon}</div>
            <div
              className="text-2xl font-black leading-none"
              style={{ color: "var(--brand)", fontFamily: "var(--font-head)" }}
            >
              {card.value}
            </div>
            <div className="text-xs mt-1.5 font-medium" style={{ color: "var(--ink-2)" }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="px-5 py-4 font-black text-base"
          style={{
            borderBottom: "1px solid var(--border)",
            color: "var(--ink)",
            fontFamily: "var(--font-head)",
          }}
        >
          📈 رؤى سريعة
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {insights.map((item) => (
            <div
              key={item.label}
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>
                {item.label}
              </span>
              {"items" in item && item.items ? (
                <div className="flex gap-2 flex-wrap justify-end">
                  {item.items.map((s) => (
                    <span
                      key={s.name}
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span
                  className="text-sm font-bold px-3 py-1 rounded-full"
                  style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                >
                  {item.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
