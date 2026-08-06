"use client";
import { useState } from "react";

export default function AIPromptLibrary() {
  const [prompts] = useState([
    { key: "EXPLAIN_CONCEPT", version: 3, label: "برومبت شرح المفهوم", updated: "2026-07-20" },
    { key: "GENERATE_QUIZ", version: 5, label: "برومبت توليد أسئلة الاختبارات", updated: "2026-07-22" },
    { key: "SUMMARIZE_LESSON", version: 2, label: "برومبت تلخيص الدرس", updated: "2026-07-15" },
    { key: "GRADE_ADJUSTMENT_CHECK", version: 4, label: "برومبت مراجعة شكوى الدرجات", updated: "2026-07-21" },
  ]);

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prompts.map((p) => (
          <div key={p.key} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-[var(--ink)]">{p.label}</h3>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                v{p.version}
              </span>
            </div>
            <div className="text-xs font-mono text-[var(--ink-2)] mb-4">{p.key}</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--ink-3)]">آخر تحديث: {p.updated}</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]">تعديل</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)]">تراجع v{p.version - 1}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
