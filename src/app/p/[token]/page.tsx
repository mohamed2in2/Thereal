"use client";

import { use, useEffect, useState } from "react";

export default function ParentPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`/api/parent/portal?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setData(json);
        } else {
          setError(json.error || "رابط ولي الأمر غير صالح أو تم التعديل عليه");
        }
      } catch (err: any) {
        setError(err?.message || "حدث خطأ أثناء تحميل التقارير");
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center dir-rtl">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-white">جاري تحميل تقرير الطالب...</h2>
        <p className="text-xs text-slate-400 mt-1">يرجى الانتظار لحظات</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center dir-rtl">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mb-4 border border-rose-500/30">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-white mb-2">عذراً، الرابط غير متاح</h2>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">{error}</p>
        <a
          href="https://wa.me/201012345678"
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg transition-all"
        >
          💬 التواصل مع الدعم الفني منصة Code-UP
        </a>
      </div>
    );
  }

  const { student, overallAveragePercent, overallStatusBadge, attendancePercent, homeworkStats, recentExams, teacherNotes, structuredAdvice } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 pb-20 dir-rtl selection:bg-emerald-500 selection:text-slate-950">
      <div className="max-w-xl mx-auto space-y-5">
        {/* TOP BRAND BAR */}
        <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-lg font-bold text-emerald-400">
              UP
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">Code-UP Educational Platform</h1>
              <p className="text-[11px] text-slate-400">بوابة متابعة ولي الأمر التفاعلية 🎓</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            تقرير حي مباشر
          </span>
        </div>

        {/* HEADER REPORT CARD - STUDENT OVERALL PROFILE */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              👤
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{student.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">{student.educationalStage}</p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
                <span>{overallStatusBadge.label}</span>
                <span className="text-slate-300">({overallStatusBadge.text})</span>
              </div>
            </div>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS GRID */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-xs text-slate-400 font-bold">المعدل العام للدرجات</p>
            <p className="text-2xl font-black text-emerald-400">{overallAveragePercent}%</p>
            <p className="text-[10px] text-slate-500 font-semibold">ممتاز جداً 🟢</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
            <p className="text-xs text-slate-400 font-bold">نسبة الحضور والالتزام</p>
            <p className="text-2xl font-black text-sky-400">{attendancePercent}%</p>
            <p className="text-[10px] text-slate-500 font-semibold">منظم في المواعيد 🟢</p>
          </div>
        </div>

        {/* EXAM & QUIZ RESULTS TABLE */}
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <span>📊 أحدث نتائج الاختبارات والامتحانات</span>
            </h3>
            <span className="text-xs text-slate-400">آخر 8 اختبارات</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3">اسم الاختبار</th>
                  <th className="p-3 text-center">الدرجة</th>
                  <th className="p-3 text-center">النسبة</th>
                  <th className="p-3 text-center">التقييم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-semibold">
                {recentExams && recentExams.length > 0 ? (
                  recentExams.map((ex: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-200">{ex.title}</td>
                      <td className="p-3 text-center font-mono text-slate-300">
                        {ex.score} / {ex.maxScore}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-white">{ex.percent}%</td>
                      <td className="p-3 text-center text-base">{ex.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 text-xs">
                      لا توجد نتائج مسجلة مؤخراً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HOMEWORK TRACKING CARDS */}
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-3">
          <h3 className="font-extrabold text-white text-sm">📚 متابعة تسليم الواجبات والتطبيقات</h3>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-bold">المكتملة ✅</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">{homeworkStats.completed}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-bold">في الانتظار 🟡</p>
              <p className="text-lg font-bold text-amber-400 mt-1">{homeworkStats.pending}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-bold">المتأخرة 🔴</p>
              <p className="text-lg font-bold text-rose-400 mt-1">{homeworkStats.late}</p>
            </div>
          </div>
        </div>

        {/* STRUCTURED 4-CARD ACADEMIC ADVICE */}
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-3">
          <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
            <span>💡 تقرير وتوجيهات معلم المادة لولي الأمر</span>
          </h3>

          <div className="space-y-2.5">
            {/* Card 1: Strengths */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <p className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                <span>✅</span> نقاط القوة (Strengths)
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {structuredAdvice.strengths}
              </p>
            </div>

            {/* Card 2: Needs Attention */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <p className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                <span>⚠️</span> تحتاج اهتمام ومتابعة (Needs Attention)
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {structuredAdvice.needsAttention}
              </p>
            </div>

            {/* Card 3: Recommendation */}
            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 space-y-1">
              <p className="font-bold text-sky-400 text-xs flex items-center gap-1.5">
                <span>📚</span> توصيات دراسية لولي الأمر
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {structuredAdvice.recommendation}
              </p>
            </div>

            {/* Card 4: Teacher Advice */}
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-1">
              <p className="font-bold text-purple-400 text-xs flex items-center gap-1.5">
                <span>👨‍🏫</span> نصيحة معلم المادة
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {structuredAdvice.teacherAdvice}
              </p>
            </div>
          </div>
        </div>

        {/* TEACHER DIRECT NOTES */}
        {teacherNotes && teacherNotes.length > 0 && (
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="font-extrabold text-white text-sm">📝 ملاحظات المعلم المباشرة</h3>
            <div className="space-y-2">
              {teacherNotes.map((note: any, idx: number) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-400 font-bold">
                    <span>{note.teacherName}</span>
                    <span className="font-mono text-[10px]">{note.date}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-medium">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LARGE TOUCH ACTION BUTTONS FOR PARENTS (MIN 48PX) */}
        <div className="space-y-3 pt-2">
          <a
            href="https://wa.me/201012345678?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%A3%D9%86%D8%A7%20%D9%88%D9%84%D9%8A%20%D8%A3%D9%85%D8%B1%20%D8%A7%D9%84%D8%B7%D8%A7%D9%84%D8%A8%20"
            target="_blank"
            rel="noreferrer"
            className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>💬</span> التواصل مع المعلم عبر الواتساب
          </a>

          <a
            href="https://wa.me/201012345678"
            target="_blank"
            rel="noreferrer"
            className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>🛠️</span> التواصل مع الدعم الفني لمنصة Code-UP
          </a>
        </div>
      </div>
    </div>
  );
}
