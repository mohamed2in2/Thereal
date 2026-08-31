import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ShieldCheck, Scale, Wallet, RotateCcw, AlertTriangle, CheckCircle2, Lock } from "lucide-react";

export const metadata = {
  title: "الشروط والأحكام | منصة Code-UP",
  description: "اتفاقية الشروط والأحكام وسياسة الخصوصية وحقوق الملكية الفكرية",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200" dir="rtl">
      <Navbar />

      <main className="flex-1 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-sm font-bold mb-4 shadow-sm">
              <Scale className="w-4 h-4 text-sky-400" />
              <span>الاتفاقية الرسمية والشروط القانونية</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
              الشروط والأحكام
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              يرجى قراءة البنود التالية بعناية. بالضغط على زر «أوافق على الشروط والأحكام» فإنك تقر بأنك قد قرأت هذه الاتفاقية وفهمتها وتوافق على الالتزام بجميع بنودها.
            </p>
          </div>

          {/* Important Notice Banner */}
          <div className="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-950/60 via-slate-900/90 to-sky-950/60 border border-sky-500/40 shadow-xl backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5 border border-sky-400/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="leading-relaxed">
                <h2 className="text-base sm:text-lg font-black text-white mb-1.5">
                  إقرار الموافقة والالتزام
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  يرجى قراءة البنود التالية بعناية. بالضغط على زر «أوافق على الشروط والأحكام» فإنك تقر بأنك قد قرأت هذه الاتفاقية وفهمتها وتوافق على الالتزام بجميع بنودها.
                </p>
              </div>
            </div>
          </div>

          {/* Policy Sections */}
          <div className="space-y-6 sm:space-y-8">
            {/* أولًا: حقوق الملكية الفكرية */}
            <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-black text-sm border border-purple-500/30">
                  <Lock className="w-4 h-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  أولًا: حقوق الملكية الفكرية
                </h2>
              </div>
              <div className="space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  جميع المحتويات التعليمية المعروضة على منصة Code-UP، بما في ذلك الفيديوهات، والملفات، والملخصات، والاختبارات، والتسجيلات الصوتية، والصور، وأي مواد تعليمية أخرى، هي ملك لمنصة Code-UP أو للجهات وأصحاب الحقوق الذين منحوا المنصة حق نشرها واستخدامها.
                </p>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-rose-500/30 text-rose-200">
                  <p className="font-bold mb-1 flex items-center gap-1.5 text-xs sm:text-sm">
                    <span>⚠️</span>
                    <span>حظر النسخ وإعادة النشر:</span>
                  </p>
                  <p className="text-xs sm:text-sm text-rose-300/90">
                    يحظر نسخ أو تصوير أو تسجيل أو إعادة نشر أو توزيع أو بيع أو مشاركة أي جزء من المحتوى بأي وسيلة دون موافقة كتابية مسبقة من منصة Code-UP أو صاحب الحق.
                  </p>
                </div>
                <p className="text-slate-400 font-semibold text-xs">
                  • تحتفظ المنصة بحق اتخاذ الإجراءات القانونية اللازمة في حالة انتهاك حقوق الملكية الفكرية.
                </p>
              </div>
            </section>

            {/* ثانيًا: سياسة الرصيد والمدفوعات */}
            <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-500/30">
                  <Wallet className="w-4 h-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  ثانيًا: سياسة الرصيد والمدفوعات
                </h2>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed list-disc list-inside">
                <li>
                  جميع المبالغ التي يتم شحنها إلى محفظة الطالب داخل منصة Code-UP <strong className="text-white">لا يمكن استردادها نقدًا أو تحويلها إلى أموال خارج المنصة</strong> بعد إتمام عملية الشحن.
                </li>
                <li>
                  يحق للطالب استخدام الرصيد المشحون بالكامل في شراء أي من الكورسات أو الخدمات التعليمية المتاحة داخل المنصة.
                </li>
              </ul>
            </section>

            {/* ثالثًا: إلغاء الاشتراك في الكورس */}
            <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-black text-sm border border-sky-500/30">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  ثالثًا: إلغاء الاشتراك في الكورس
                </h2>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  • يحق للطالب طلب إلغاء الاشتراك في الكورس خلال مدة أقصاها <strong className="text-sky-300">٢٤ ساعة</strong> من تاريخ الاشتراك.
                </p>
                <p>
                  • في حال قبول طلب الإلغاء وفقًا لسياسة المنصة، يتم إعادة قيمة الكورس إلى <strong className="text-white">محفظة الطالب داخل المنصة فقط</strong>، ولا يتم ردها نقدًا أو تحويلها إلى أي وسيلة دفع خارجية.
                </p>
                <p>
                  • يمكن للطالب استخدام الرصيد المسترد للاشتراك في أي كورس آخر داخل المنصة، سواء كان في نفس المادة أو في مادة مختلفة.
                </p>
              </div>
            </section>

            {/* رابعًا: الظروف القاهرة الخاصة بالمعلم */}
            <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-black text-sm border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  رابعًا: الظروف القاهرة الخاصة بالمعلم
                </h2>
              </div>
              <div className="space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  في حال تعرض أحد المعلمين لظرف قهري، مثل الوفاة أو المرض الشديد — لا قدر الله — أو أي ظرف قهري آخر يمنعه من استكمال تقديم الكورس، تلتزم منصة Code-UP باستمرار تقديم الخدمة التعليمية للطلاب عن طريق معلمين آخرين.
                </p>
                <p>
                  يجوز للمنصة الاستعانة بالمحتوى التعليمي الذي سبق أن قام المعلم بتسجيله، بشرط أن يكون مطابقًا للمنهج الدراسي المعتمد بنسبة كاملة، وألا يترتب على استخدامه أي نقص أو تغيير في المحتوى العلمي.
                </p>
              </div>
            </section>

            {/* خامسًا: الموافقة */}
            <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/40 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black text-sm border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  خامسًا: الموافقة
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mb-4 font-medium">
                بالضغط على زر «أوافق على الشروط والأحكام»، فإن الطالب يقر بأنه:
              </p>
              <div className="space-y-2.5">
                {[
                  "اطلعت على جميع البنود السابقة وفهمتها.",
                  "أوافق على الالتزام بها.",
                  "أقر بأن موافقتي الإلكترونية تُعد موافقة ملزمة وفقًا للأنظمة والقوانين المعمول بها.",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-200 text-xs sm:text-sm font-semibold">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
