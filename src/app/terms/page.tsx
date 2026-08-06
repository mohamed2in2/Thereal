import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";

export const metadata = {
  title: "شروط الاستخدام | منصة Code-UP",
  description: "شروط وأحكام استخدام منصة Code-UP للكورسات",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-1 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 md:p-12 border border-gray-100 dark:border-gray-700">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-8">شروط الاستخدام</h1>
            
            <div className="space-y-8 text-gray-600 dark:text-gray-300 leading-relaxed">
              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. قبول الشروط</h2>
                <p>
                  باستخدامك لمنصة Code-UP، فإنك توافق على الالتزام بشروط الاستخدام هذه. إذا كنت لا توافق على هذه الشروط، يرجى عدم استخدام المنصة.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. حساب المستخدم</h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>أنت مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور.</li>
                  <li>يجب أن تكون المعلومات التي تقدمها عند التسجيل صحيحة ودقيقة.</li>
                  <li>يُمنع مشاركة حسابك مع أشخاص آخرين. الكورسات مخصصة للمشترك الأصلي فقط.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. الملكية الفكرية</h2>
                <p>
                  جميع المحتويات المتوفرة على المنصة من فيديوهات، نصوص، اختبارات، ومواد أخرى هي ملكية فكرية خالصة لمنصة Code-UP ولمقدمي المحتوى. يُمنع منعاً باتاً تسجيل، أو تحميل، أو إعادة توزيع أي جزء من المحتوى بدون إذن كتابي مسبق.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. سياسة الدفع والاسترداد</h2>
                <p>
                  يتم شراء الكورسات عبر طرق الدفع المتاحة أو أكواد الوصول. جميع المشتريات نهائية، ولا يمكن استرداد المبالغ المدفوعة إلا في حالات محددة وحسب تقييم الإدارة.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. التعديلات على الشروط</h2>
                <p>
                  نحتفظ بالحق في تعديل شروط الاستخدام في أي وقت. سيتم إشعار المستخدمين بأي تغييرات جوهرية، واستمرار استخدامك للمنصة يعتبر قبولاً للشروط المعدلة.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
