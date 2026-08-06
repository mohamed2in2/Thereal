import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";

export const metadata = {
  title: "سياسة الخصوصية | منصة Code-UP",
  description: "سياسة الخصوصية والمعلومات التي نجمعها في منصة Code-UP",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-1 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 md:p-12 border border-gray-100 dark:border-gray-700">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-8">سياسة الخصوصية</h1>
            
            <div className="space-y-8 text-gray-600 dark:text-gray-300 leading-relaxed">
              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. مقدمة</h2>
                <p>
                  نحن في منصة Code-UP نأخذ خصوصيتك على محمل الجد. توضح هذه السياسة كيف نجمع بياناتك، وكيف نستخدمها، وكيف نحميها لضمان تجربة آمنة وموثوقة.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. المعلومات التي نجمعها</h2>
                <p className="mb-4">نقوم بجمع الأنواع التالية من المعلومات لتوفير وتحسين خدماتنا:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>المعلومات الشخصية:</strong> مثل الاسم، رقم الهاتف، ورقم هاتف ولي الأمر.</li>
                  <li><strong>بيانات الاستخدام:</strong> مثل الكورسات التي تشاهدها، نتائج الاختبارات، وتقدمك التدريبي.</li>
                  <li><strong>بيانات التفاعل:</strong> محادثاتك مع المساعد الذكي وأسئلتك.</li>
                  <li><strong>البيانات التقنية:</strong> مثل عنوان IP، نوع المتصفح، ومعلومات الجهاز الأساسية لمنع الاحتيال والمشاركة غير المصرحة للحسابات.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. كيف نستخدم معلوماتك؟</h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>لإنشاء حسابك وإدارته وتوفير الوصول للكورسات.</li>
                  <li>لتخصيص تجربتك وتقديم مقترحات وخطط دراسية تتناسب مع مستواك بواسطة المساعد الذكي.</li>
                  <li>لتتبع تقدمك وعرض نتائجك لك ولأولياء الأمور.</li>
                  <li>للتواصل معك وإرسال التحديثات والتنبيهات المهمة.</li>
                  <li>لضمان أمن وحماية المنصة من الاستخدام غير المصرح به (مثل مشاركة الحسابات).</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. حماية البيانات</h2>
                <p>
                  نحن نستخدم إجراءات أمنية وتقنية متقدمة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفشاء. يتم تشفير كلمات المرور والبيانات الحساسة لضمان أقصى درجات الأمان.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. مشاركة المعلومات</h2>
                <p>
                  نحن لا نبيع أو نؤجر معلوماتك الشخصية لأي أطراف ثالثة. قد نشارك بعض البيانات الإحصائية غير المحددة للهوية لأغراض البحث والتحسين، أو مع المعلمين لمتابعة أدائك داخل الكورسات المسجل بها.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. التواصل معنا</h2>
                <p>
                  إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية أو طريقة تعاملنا مع بياناتك، يمكنك التواصل معنا عبر البريد الإلكتروني: <a href="mailto:contact@code-up.tech" className="text-blue-500 hover:underline">contact@code-up.tech</a>
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
