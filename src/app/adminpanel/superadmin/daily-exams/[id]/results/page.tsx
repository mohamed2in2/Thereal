import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Users, CheckCircle2, XCircle } from "lucide-react";

export default async function DailyExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const exam = await prisma.dailyExam.findUnique({
    where: { id: resolvedParams.id },
    include: {
      results: {
        include: { student: true },
        orderBy: { score: "desc" }
      },
      _count: {
        select: { questions: true }
      }
    }
  });

  if (!exam) return notFound();

  return (
    <div className="p-6">
      <div className="mb-8">
        <Link 
          href="/adminpanel/superadmin/daily-exams"
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition mb-4 w-max"
        >
          <ArrowRight className="w-4 h-4" /> العودة للقائمة
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">نتائج التحدي: {exam.title}</h1>
        <p className="text-slate-500 mt-1">تاريخ التحدي: {exam.date.toLocaleDateString('ar-EG')} - {exam.educationalStage}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">إجمالي المشاركين</p>
            <h3 className="text-2xl font-bold text-slate-800">{exam.results.length} طالب</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">متوسط الدرجات</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {exam.results.length > 0 ? (exam.results.reduce((acc, curr) => acc + curr.score, 0) / exam.results.length).toFixed(1) : 0} / {exam._count.questions}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 text-slate-600 font-semibold">المتعلم</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">الدرجة</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">تاريخ الانتهاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exam.results.length > 0 ? exam.results.map((result, index) => (
              <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{result.student.name}</p>
                      <p className="text-xs text-slate-500">{result.student.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`font-bold ${result.score === exam._count.questions ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {result.score} / {result.totalQ}
                  </span>
                </td>
                <td className="py-4 px-6 text-slate-600 text-sm">
                  {result.completedAt.toLocaleString('ar-EG')}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-500">
                  لا توجد نتائج مسجلة لهذا التحدي حتى الآن.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
