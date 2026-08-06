"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { EDUCATIONAL_STAGES } from "@/types";

interface Question {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
}

interface DailyExam {
  id: string;
  title: string;
  educationalStage: string;
  date: string;
  timeLimitMinutes: number;
  isActive: boolean;
  _count?: { questions: number; results: number };
  questions?: Question[];
}

export function DailyExamsSection() {
  const [exams, setExams] = useState<DailyExam[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  const [newExam, setNewExam] = useState({ title: "", educationalStage: "sec_1", date: "", timeLimitMinutes: 30 });
  const [selectedExam, setSelectedExam] = useState<DailyExam | null>(null);
  
  const [newQuestion, setNewQuestion] = useState({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" });

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/admin/superadmin/daily-exams");
      const data = await res.json();
      if (res.ok) setExams(data.exams);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamDetails = async (id: string) => {
    const res = await fetch(`/api/admin/superadmin/daily-exams/${id}`);
    const data = await res.json();
    if (res.ok) setSelectedExam(data.exam);
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/superadmin/daily-exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newExam)
    });
    const data = await res.json();
    if (res.ok) {
      success("تم إنشاء الامتحان بنجاح");
      fetchExams();
      setNewExam({ title: "", educationalStage: "sec_1", date: "", timeLimitMinutes: 30 });
    } else {
      error(data.error || "خطأ في إنشاء الامتحان");
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await fetch(`/api/admin/superadmin/daily-exams/${id}`, { method: "DELETE" });
    if (res.ok) {
      success("تم الحذف بنجاح");
      fetchExams();
      if (selectedExam?.id === id) setSelectedExam(null);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/superadmin/daily-exams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive })
    });
    if (res.ok) {
      fetchExams();
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    const res = await fetch(`/api/admin/superadmin/daily-exams/${selectedExam.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newQuestion)
    });
    const data = await res.json();
    if (res.ok) {
      success("تمت إضافة السؤال بنجاح");
      fetchExamDetails(selectedExam.id);
      fetchExams();
      setNewQuestion({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" });
    } else {
      error(data.error || "خطأ في إضافة السؤال");
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("هل أنت متأكد من حذف السؤال؟") || !selectedExam) return;
    const res = await fetch(`/api/admin/superadmin/daily-exams/questions/${qId}`, { method: "DELETE" });
    if (res.ok) {
      success("تم حذف السؤال");
      fetchExamDetails(selectedExam.id);
      fetchExams();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">جار التحميل...</div>;

  return (
    <div className="space-y-6">
      {selectedExam ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-gray-700 pb-4">
            <div>
              <button onClick={() => setSelectedExam(null)} className="text-sm text-sky-500 hover:underline mb-2 block">← العودة للقائمة</button>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedExam.title}</h2>
              <p className="text-sm text-slate-500 mt-1">إدارة الأسئلة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800">
              <h3 className="font-bold mb-4 text-slate-900 dark:text-white">إضافة سؤال جديد</h3>
              <form onSubmit={handleAddQuestion} className="space-y-3">
                <textarea
                  value={newQuestion.question}
                  onChange={e => setNewQuestion({...newQuestion, question: e.target.value})}
                  placeholder="نص السؤال..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  rows={3}
                  required
                />
                <input
                  type="text" value={newQuestion.optionA} onChange={e => setNewQuestion({...newQuestion, optionA: e.target.value})} placeholder="الخيار أ"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white" required
                />
                <input
                  type="text" value={newQuestion.optionB} onChange={e => setNewQuestion({...newQuestion, optionB: e.target.value})} placeholder="الخيار ب"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white" required
                />
                <input
                  type="text" value={newQuestion.optionC} onChange={e => setNewQuestion({...newQuestion, optionC: e.target.value})} placeholder="الخيار ج"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white" required
                />
                <input
                  type="text" value={newQuestion.optionD} onChange={e => setNewQuestion({...newQuestion, optionD: e.target.value})} placeholder="الخيار د"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white" required
                />
                <select
                  value={newQuestion.correctAnswer} onChange={e => setNewQuestion({...newQuestion, correctAnswer: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-white" required
                >
                  <option value="A">الخيار أ هو الصحيح</option>
                  <option value="B">الخيار ب هو الصحيح</option>
                  <option value="C">الخيار ج هو الصحيح</option>
                  <option value="D">الخيار د هو الصحيح</option>
                </select>
                <button type="submit" className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg transition-colors">
                  إضافة السؤال
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-gray-700 pb-2">الأسئلة الحالية ({selectedExam.questions?.length || 0})</h3>
              {selectedExam.questions?.map((q, i) => (
                <div key={q.id} className="p-4 bg-slate-50 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      <span className="text-sky-500 ml-1">{i + 1}.</span> {q.question}
                    </p>
                    <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors shrink-0">
                      حذف
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-2 rounded-lg border ${q.correctAnswer === "A" ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700/50" : "bg-white border-slate-200 dark:bg-gray-800 dark:border-gray-700"}`}>أ: {q.optionA}</div>
                    <div className={`p-2 rounded-lg border ${q.correctAnswer === "B" ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700/50" : "bg-white border-slate-200 dark:bg-gray-800 dark:border-gray-700"}`}>ب: {q.optionB}</div>
                    <div className={`p-2 rounded-lg border ${q.correctAnswer === "C" ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700/50" : "bg-white border-slate-200 dark:bg-gray-800 dark:border-gray-700"}`}>ج: {q.optionC}</div>
                    <div className={`p-2 rounded-lg border ${q.correctAnswer === "D" ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700/50" : "bg-white border-slate-200 dark:bg-gray-800 dark:border-gray-700"}`}>د: {q.optionD}</div>
                  </div>
                </div>
              ))}
              {selectedExam.questions?.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">لا توجد أسئلة بعد</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Create Exam */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🏆</span> إضافة امتحان جديد للوحة الشرف
            </h2>
            <form onSubmit={handleCreateExam} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">عنوان الامتحان</label>
                <input
                  type="text" value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} required
                  placeholder="مثال: التحدي اليومي - الاثنين"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">المرحلة التدريبية</label>
                <select
                  value={newExam.educationalStage} onChange={e => setNewExam({...newExam, educationalStage: e.target.value})} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                >
                  {EDUCATIONAL_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">تاريخ التحدي</label>
                <input
                  type="date" value={newExam.date} onChange={e => setNewExam({...newExam, date: e.target.value})} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">المدة (دقائق)</label>
                <input
                  type="number" value={newExam.timeLimitMinutes} onChange={e => setNewExam({...newExam, timeLimitMinutes: parseInt(e.target.value) || 30})} required min="1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                />
              </div>
              <button type="submit" className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg transition-colors w-full sm:w-auto">
                إنشاء
              </button>
            </form>
          </div>

          {/* List Exams */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center bg-slate-50 dark:bg-gray-900/50">
              <h2 className="font-bold text-slate-900 dark:text-white">قائمة الامتحانات اليومية</h2>
              <span className="text-xs bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 px-2 py-1 rounded-full">{exams.length} امتحانات</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {exams.map(exam => (
                <div key={exam.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {exam.title}
                      {!exam.isActive && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">معطل</span>}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 flex gap-3">
                      <span>📅 {new Date(exam.date).toLocaleDateString("ar-EG")}</span>
                      <span>⏱️ {exam.timeLimitMinutes} دقيقة</span>
                      <span>📝 {exam._count?.questions || 0} أسئلة</span>
                      <span>👨‍🎓 {exam._count?.results || 0} مجيب</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fetchExamDetails(exam.id)} className="px-3 py-1.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-white text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors">
                      إدارة الأسئلة
                    </button>
                    <button onClick={() => handleToggleStatus(exam.id, exam.isActive)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${exam.isActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {exam.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button onClick={() => handleDeleteExam(exam.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {exams.length === 0 && <div className="p-8 text-center text-slate-500">لا توجد امتحانات، أضف امتحاناً جديداً للبدء</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
