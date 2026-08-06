"use client";
export default function AIStudentAnalytics() {
  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xl mb-1">🎓</div>
          <div className="text-2xl font-black text-[var(--brand)]">312</div>
          <div className="text-xs text-[var(--ink-2)] mt-1">طالب يتفاعل مع AI شهرياً</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xl mb-1">💬</div>
          <div className="text-2xl font-black text-[var(--brand)]">13.5</div>
          <div className="text-xs text-[var(--ink-2)] mt-1">متوسط الأسئلة لكل طالب</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xl mb-1">📈</div>
          <div className="text-2xl font-black text-[var(--brand)]">+18%</div>
          <div className="text-xs text-[var(--ink-2)] mt-1">تحسن مستويات الطلاب المتفاعلين</div>
        </div>
      </div>
    </div>
  );
}
