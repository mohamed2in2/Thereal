"use client";
export default function AICostAnalytics() {
  return (
    <div dir="rtl" className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-bold text-base text-[var(--ink)] mb-3">تحليلات التكلفة التفصيلية</h3>
        <p className="text-xs text-[var(--ink-2)]">معدل الإنفاق اليومي المستهدف: أقل من $1.50/يوم. المعدل الحالي: $0.14/ساعة.</p>
      </div>
    </div>
  );
}
