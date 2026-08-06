"use client";
import { useState } from "react";

export default function AITools() {
  const [tools] = useState([
    { name: "grade_request_tool", desc: "إنشاء طلب تعديل درجة في قاعدة البيانات", calls: 142, enabled: true },
    { name: "support_ticket_tool", desc: "توليد تذكرة دعم فني أو شكوى", calls: 89, enabled: true },
    { name: "feedback_tool", desc: "تسجيل ملاحظات الطالب حول الكورس والمدرس", calls: 45, enabled: true },
    { name: "insights_fetcher_tool", desc: "جلب إحصائيات الطالب وتاريخ درجاته", calls: 310, enabled: true },
  ]);

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((t) => (
          <div key={t.name} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-bold text-[var(--brand)]">{t.name}</span>
              <span className="text-xs font-bold text-[var(--ink-2)]">{t.calls} استدعاء اليوم</span>
            </div>
            <p className="text-xs text-[var(--ink-2)] mb-4">{t.desc}</p>
            <div className="flex justify-end">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--brand)]">نشط وآمن 🔒</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
