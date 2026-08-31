"use client";

import { useEffect, useState } from "react";

interface SubscriptionStatusBadgeProps {
  teacherId: string;
  teacherName: string;
}

function formatPlanLabel(label: string): string {
  if (!label) return "سنة كاملة";
  const isLang = label.includes("لغات") || label.includes("English") || label.includes("GB");
  const track = isLang ? " (لغات)" : " (عربي)";

  if (label.includes("6 شهور") || label.includes("10 شهور") || label.includes("Months") || label.includes("سنوي") || label.includes("سنة")) {
    return "سنة كاملة" + track;
  }
  if (label.includes("3 شهور") || label.includes("ترم")) {
    return "ترم كامل" + track;
  }
  if (label.includes("شهر واحد") || label.includes("شهر")) {
    return "اشتراك شهري" + track;
  }
  return label;
}

export function SubscriptionStatusBadge({ teacherId, teacherName }: SubscriptionStatusBadgeProps) {
  const [sub, setSub] = useState<{
    id: string;
    planLabel: string;
    amount: number;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId) return;
    fetch(`/api/teacher/my-subscription?teacherId=${teacherId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.subscription) {
          setSub(d.subscription);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teacherId]);

  if (loading || !sub) return null;

  const displayPlanLabel = formatPlanLabel(sub.planLabel);

  return (
    <div className="my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 max-w-md mx-auto text-center shadow-sm backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-center gap-2 font-black text-sm mb-1">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        ✨ أنت مشترك حالياً مع أستاذ {teacherName}!
      </div>
      <div className="text-xs font-semibold leading-relaxed">
        نوع الباقة: <span className="underline font-bold">{displayPlanLabel}</span> ({sub.amount} جنيه)
        <br />
        <span className="text-[11px] opacity-80">
          تاريخ الحجز: {new Date(sub.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
