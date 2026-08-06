import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Plus, ArrowRight, Save } from "lucide-react";
import Link from "next/link";
import { EDUCATIONAL_STAGES } from "@/types";

export default function CreateDailyExamPage() {
  async function createExam(formData: FormData) {
    "use server";
    
    const title = formData.get("title") as string;
    const educationalStage = formData.get("educationalStage") as string;
    const dateStr = formData.get("date") as string;
    const timeLimitMinutes = parseInt(formData.get("timeLimitMinutes") as string);
    const isActive = formData.get("isActive") === "on";

    // Simple question parsing (assuming 1 question for MVP)
    const question = formData.get("question_1") as string;
    const optionA = formData.get("optionA_1") as string;
    const optionB = formData.get("optionB_1") as string;
    const optionC = formData.get("optionC_1") as string;
    const optionD = formData.get("optionD_1") as string;
    const correctAnswer = formData.get("correctAnswer_1") as string;

    const date = new Date(dateStr);

    await prisma.dailyExam.create({
      data: {
        title,
        educationalStage,
        date,
        timeLimitMinutes,
        isActive,
        questions: {
          create: [{
            question,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            order: 1
          }]
        }
      }
    });

    redirect("/adminpanel/superadmin/daily-exams");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link 
          href="/adminpanel/superadmin/daily-exams"
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition mb-4 w-max"
        >
          <ArrowRight className="w-4 h-4" /> العودة للقائمة
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">إنشاء تحدي يومي جديد</h1>
      </div>

      <form action={createExam} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
        
        {/* Basic Info */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">المعلومات الأساسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">عنوان التحدي</label>
              <input required name="title" type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="مثال: تحدي الفيزياء - قوانين نيوتن" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المرحلة التدريبية</label>
              <select required name="educationalStage" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {EDUCATIONAL_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التحدي</label>
              <input required name="date" type="date" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">مدة التحدي (بالدقائق)</label>
              <input required name="timeLimitMinutes" type="number" defaultValue={15} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex items-center gap-2 mt-4 md:col-span-2">
              <input type="checkbox" name="isActive" id="isActive" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700">نشط (يظهر للمتعلمين في تاريخه)</label>
            </div>
          </div>
        </section>

        {/* Questions (Simplified for 1 question) */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">الأسئلة (السؤال الأول)</h2>
          <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نص السؤال</label>
              <textarea required name="question_1" rows={2} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="اكتب نص السؤال هنا..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الخيار (A)</label>
                <input required name="optionA_1" type="text" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الخيار (B)</label>
                <input required name="optionB_1" type="text" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الخيار (C)</label>
                <input required name="optionC_1" type="text" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الخيار (D)</label>
                <input required name="optionD_1" type="text" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الإجابة الصحيحة</label>
              <select required name="correctAnswer_1" className="w-full p-2 border border-slate-300 rounded-lg">
                <option value="A">الخيار (A)</option>
                <option value="B">الخيار (B)</option>
                <option value="C">الخيار (C)</option>
                <option value="D">الخيار (D)</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t pt-4">
          <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm">
            <Save className="w-5 h-5" />
            حفظ التحدي
          </button>
        </div>
      </form>
    </div>
  );
}
