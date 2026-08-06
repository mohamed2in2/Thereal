"use client";

import { useState, useEffect } from "react";
import { getIQData, SKILL_LABELS } from "@/lib/iq-system";
import type { IQSkillName } from "@/lib/iq-system";

export interface GameFeedbackProps {
  subject: string;
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
  maxLevel: number;
  maxStreak: number;
  difficulty: string;
  /** If true, fetches AI feedback immediately on mount */
  autoLoad?: boolean;
}

export function GameFeedback({
  subject, correctAnswers, totalQuestions, totalTimeMs,
  maxLevel, maxStreak, difficulty, autoLoad = false,
}: GameFeedbackProps) {
  const [report, setReport]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchReport = async () => {
    if (loading || fetched) return;
    setLoading(true); setError(false);

    const iqData = getIQData();
    const skillScores: Record<string, number> = {};
    (Object.keys(iqData.skills) as IQSkillName[]).forEach(sk => {
      skillScores[SKILL_LABELS[sk]] = iqData.skills[sk].score;
    });

    try {
      const res = await fetch("/api/ai/iq-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          correctAnswers,
          totalQuestions,
          avgTimeSec: totalTimeMs / totalQuestions / 1000,
          maxLevel,
          maxStreak,
          difficulty,
          skills: skillScores,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { report?: string };
      setReport(data.report ?? null);
      setFetched(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  const pct = Math.round((correctAnswers / totalQuestions) * 100);

  return (
    <div className="rounded-2xl overflow-hidden mt-3" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "linear-gradient(135deg,#7C3AED22,#2196F322)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 20 }}>🧠</span>
        <span className="text-sm font-black" style={{ color: "#7C3AED" }}>تحليل الذكاء الاصطناعي</span>
        <span className="mr-auto text-xs font-bold" style={{ color: "var(--ink-3)" }}>Gemini</span>
      </div>

      {/* Content */}
      <div className="p-4">
        {!report && !loading && !error && !fetched && (
          <div className="text-center">
            <p className="text-sm mb-3" style={{ color: "var(--ink-3)" }}>
              احصل على تغذية راجعة مخصصة لأدائك ({pct}% دقة)
            </p>
            <button onClick={fetchReport}
              className="px-5 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#7C3AED,#2196F3)" }}>
              ✨ احصل على التحليل
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{ background: "#7C3AED", animation: `bounce 0.8s ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <span className="text-sm" style={{ color: "var(--ink-3)" }}>جارٍ تحليل أدائك...</span>
          </div>
        )}

        {report && (
          <div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{report}</p>
            <button onClick={() => { setReport(null); setFetched(false); fetchReport(); }}
              className="mt-3 text-xs font-bold" style={{ color: "var(--ink-3)" }}>
              ↺ تحليل جديد
            </button>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-xs mb-2" style={{ color: "var(--ink-3)" }}>تعذّر الاتصال — حاول مرة أخرى</p>
            <button onClick={() => { setError(false); setFetched(false); fetchReport(); }}
              className="text-xs font-bold" style={{ color: "#7C3AED" }}>
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform:translateY(0) }
          40%          { transform:translateY(-6px) }
        }
      `}</style>
    </div>
  );
}
