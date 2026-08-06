"use client";
import { useState } from "react";

export default function AIAlertsCenter() {
  const [alerts] = useState([
    { id: 1, type: "warning", title: "معدل استهلاك مفتاح Gemini KEY 1 قارب الحد اليومي", time: "منذ ساعتين" },
    { id: 2, type: "info", title: "تم تفعيل التهدئة لمزود Groq تلقائياً لمدة 60 ثانية", time: "منذ 5 ساعات" },
  ]);

  return (
    <div dir="rtl" className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-bold text-base text-[var(--ink)] mb-4">مركز التنبيهات والأحداث الخاصة بـ AI</h3>
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ink)]">{a.title}</span>
              <span className="text-[var(--ink-3)]">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
