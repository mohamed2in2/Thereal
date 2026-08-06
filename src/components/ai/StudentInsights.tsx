"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface Insight {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  isRead: boolean;
  isActioned: boolean;
  actionTaken: string | null;
  createdAt: string;
}

const TYPE_STYLES: Record<string, { bg: string; icon: string; label: string }> = {
  weak_area: { bg: "from-red-500/10 to-orange-500/10 border-red-200 dark:border-red-900/40", icon: "⚠️", label: "نقطة ضعف" },
  strength: { bg: "from-emerald-500/10 to-green-500/10 border-emerald-200 dark:border-emerald-900/40", icon: "💪", label: "نقطة قوة" },
  recommendation: { bg: "from-blue-500/10 to-sky-500/10 border-blue-200 dark:border-blue-900/40", icon: "💡", label: "توصية" },
  risk_alert: { bg: "from-orange-500/10 to-red-500/10 border-orange-200 dark:border-orange-900/40", icon: "🚨", label: "تنبيه" },
  progress: { bg: "from-purple-500/10 to-fuchsia-500/10 border-purple-200 dark:border-purple-900/40", icon: "📈", label: "تقدم" },
};

export function StudentInsights({ compact = false }: { compact?: boolean }) {
  const { error } = useToast();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/insights");
      const data = await res.json();
      if (Array.isArray(data.insights)) {
        setInsights(data.insights);
      }
    } catch {
      error("فشل تحميل التحليل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [error]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    // Force regeneration by clearing client state then reloading
    setInsights([]);
    await load();
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isRead: true }),
      });
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isRead: true } : i))
      );
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        🤖 جارٍ تحليل بياناتك...
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl p-6 text-center border border-purple-100 dark:border-purple-900/40">
        <span className="text-3xl mb-2 block">🤖</span>
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-2">
          لسه ما عندناش بيانات كافية للتحليل
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ابدأ بحل الكويزات ومشاهدة الفيديوهات وهرجعلك بتحليل مفصل
        </p>
      </div>
    );
  }

  const displayInsights = compact ? insights.slice(0, 3) : insights;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🤖 رؤى مرشدك الذكي
          </h3>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
          >
            {refreshing ? "جارٍ التحديث..." : "🔄 تحديث"}
          </button>
        </div>
      )}

      {displayInsights.map((insight) => {
        const style = TYPE_STYLES[insight.type] || TYPE_STYLES.recommendation;
        return (
          <div
            key={insight.id}
            className={`relative rounded-2xl p-4 border bg-gradient-to-br ${style.bg} ${
              !insight.isRead ? "ring-2 ring-purple-300 dark:ring-purple-700" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{style.icon}</span>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                    {style.label}
                  </span>
                  {insight.category && insight.category !== "general" && (
                    <span className="text-xs bg-white/60 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {insight.category}
                    </span>
                  )}
                  {!insight.isRead && (
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  )}
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">
                  {insight.title}
                </h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {insight.description}
                </p>
              </div>
              {!insight.isRead && (
                <button
                  onClick={() => markRead(insight.id)}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline whitespace-nowrap"
                >
                  ✓
                </button>
              )}
            </div>
          </div>
        );
      })}

      {compact && insights.length > 3 && (
        <p className="text-xs text-center text-gray-500">
          + {insights.length - 3} رؤى أخرى
        </p>
      )}
    </div>
  );
}
