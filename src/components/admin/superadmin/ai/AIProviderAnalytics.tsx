"use client";
export default function AIProviderAnalytics() {
  return (
    <div dir="rtl" className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-bold text-base text-[var(--ink)] mb-3">تحليلات الأداء التنافسية بين المزودين</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div><span className="text-[var(--ink-3)] block">أسرع استجابة:</span><span className="font-bold text-[var(--brand)]">Groq (220ms)</span></div>
          <div><span className="text-[var(--ink-3)] block">الأوفر تكلفة:</span><span className="font-bold text-[var(--brand)]">Gemini Flash (Free tier)</span></div>
          <div><span className="text-[var(--ink-3)] block">الأعلى جودة وتوليد:</span><span className="font-bold text-[var(--brand)]">DeepSeek V4 Flash</span></div>
        </div>
      </div>
    </div>
  );
}
