import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Settings, Eye, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { EDUCATIONAL_STAGES } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminDailyExamsPage() {
  const exams = await prisma.dailyExam.findMany({
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: { questions: true, results: true }
      }
    }
  });

  const getStageLabel = (stageCode: string) => {
    return EDUCATIONAL_STAGES.find((s) => s.value === stageCode)?.label ?? stageCode;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة التحديات اليومية (لوحة الشرف)</h1>
          <p className="text-slate-500 mt-1">إنشاء ومتابعة الاختبارات اليومية للمتعلمين</p>
        </div>
        <Link 
          href="/adminpanel/superadmin/daily-exams/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          إنشاء تحدي جديد
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 text-slate-600 font-semibold">التحدي</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">المرحلة التدريبية</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">التاريخ</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">الأسئلة</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">المشاركات</th>
              <th className="py-4 px-6 text-slate-600 font-semibold">الحالة</th>
              <th className="py-4 px-6 text-slate-600 font-semibold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exams.length > 0 ? exams.map((exam) => (
              <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-medium text-slate-800">{exam.title}</td>
                <td className="py-4 px-6 text-slate-600">{getStageLabel(exam.educationalStage)}</td>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {exam.date.toLocaleDateString('ar-EG')}
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600">{exam._count.questions}</td>
                <td className="py-4 px-6 text-slate-600">{exam._count.results}</td>
                <td className="py-4 px-6">
                  {exam.isActive ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium bg-emerald-50 px-2 py-1 rounded-full w-max">
                      <CheckCircle2 className="w-4 h-4" /> نشط
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded-full w-max">
                      <XCircle className="w-4 h-4" /> غير نشط
                    </span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <div className="flex justify-center gap-2">
                    <Link 
                      href={`/adminpanel/superadmin/daily-exams/${exam.id}/results`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition tooltip-trigger"
                      title="عرض النتائج"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <Link 
                      href={`/adminpanel/superadmin/daily-exams/${exam.id}/edit`}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition tooltip-trigger"
                      title="تعديل"
                    >
                      <Settings className="w-5 h-5" />
                    </Link>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  لا توجد تحديات يومية بعد. قم بإنشاء التحدي الأول!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
