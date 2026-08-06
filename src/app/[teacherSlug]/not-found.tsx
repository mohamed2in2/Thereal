import Link from "next/link";

export default function TeacherNotFound() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
          <svg className="w-7 h-7 text-[var(--ink-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-[var(--ink)]">هذه الصفحة غير موجودة</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1.5 leading-relaxed">قد يكون الرابط خاطئاً أو أن المعلم لم ينشر صفحته بعد.</p>
        <Link href="/courses" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors">
          تصفّح الكورسات
        </Link>
      </div>
    </main>
  );
}
