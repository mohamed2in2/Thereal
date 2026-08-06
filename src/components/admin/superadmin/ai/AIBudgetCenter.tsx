"use client";
import { useState } from "react";

export default function AIBudgetCenter() {
  const [budgetLimit] = useState(50);
  const [spent] = useState(18.45);

  const percentage = Math.min(100, Math.round((spent / budgetLimit) * 100));

  return (
    <div dir="rtl" className="space-y-6">
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-black mb-2" style={{ color: "var(--ink)" }}>الميزانية الشهرية المخصصة لـ AI</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-[var(--ink-2)]">المستهلك: ${spent} من ${budgetLimit}</span>
          <span className="text-sm font-bold text-[var(--brand)]">{percentage}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h4 className="font-bold text-sm mb-3 text-[var(--ink)]">أعلى المواد استهلاكاً</h4>
          <div className="space-y-2 text-xs font-semibold">
            <div className="flex justify-between"><span>الفيزياء</span><span className="font-mono">$8.20</span></div>
            <div className="flex justify-between"><span>الرياضيات</span><span className="font-mono">$5.40</span></div>
            <div className="flex justify-between"><span>الكيمياء</span><span className="font-mono">$3.10</span></div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h4 className="font-bold text-sm mb-3 text-[var(--ink)]">أعلى العمليات تكلفة</h4>
          <div className="space-y-2 text-xs font-semibold">
            <div className="flex justify-between"><span>توليد الاختبارات</span><span className="font-mono">$10.15</span></div>
            <div className="flex justify-between"><span>الشروحات المطولة</span><span className="font-mono">$6.10</span></div>
            <div className="flex justify-between"><span>التلخيصات</span><span className="font-mono">$2.20</span></div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h4 className="font-bold text-sm mb-3 text-[var(--ink)]">توصيات التوفير</h4>
          <ul className="text-xs text-[var(--ink-2)] space-y-1.5 list-disc list-inside">
            <li>زيادة نسبة تفعيل الكاش لعملية التلخيص.</li>
            <li>تحويل الاستفسارات البسيطة لـ Gemini Flash Lite.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
