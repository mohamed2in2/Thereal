/**
 * Comprehensive SEO & GEO Keyword Matrix for Code-UP Platform
 * Covering Programming, AI, Baccalaureate, Secondary & Middle School stages,
 * Parent Tracking, Multi-Teacher, In-App Compiler, Exam Prep, and Ministry Curricula.
 */

// 1. Core Platform & Brand Keywords
const BRAND_TERMS = [
  "Code-UP", "CodeUp", "CodeUp Academy", "Code-UP Tech", "منصة كود اب", "منصة code up", "منصة codeup",
  "كود اب", "كوداب", "منصة كوداب التعليمية", "منصة Code-UP التعليمية", "موقع كود اب", "اكاديمية كود اب",
  "code-up.tech", "تطبيق كود اب", "بوابة كود اب"
];

// 2. High-Intent Modifiers (البادئات والصفات التفضيلية)
const MODIFIERS = [
  "أفضل منصة", "أحسن منصة", "المنصة الأولى", "أقوى منصة", "أفضل موقع", "أقوى موقع",
  "شرح منهج", "مراجعة نهائية", "بنك أسئلة", "حل امتحانات", "توقعات ليلة الامتحان",
  "تأسيس في", "كورس", "كورسات", "مذكرات", "ملخص", "شيتات وتمارين", "تدريب تفاعلي",
  "منصة متابعة", "أفضل نظام متابعة", "أفضل منصة تعليمية", "منصة تفاعلية", "أقوى شرح",
  "تفكيك وشرح", "امتحانات واختبارات", "نماذج إجابات", "حل كتاب الوزارة", "مراجعة شهرية",
  "محرر أكواد مدمج", "تطبيق عملي ونظري", "تعدد مدرسين", "تقارير ولي الأمر في"
];

// 3. Subjects & Disciplines (المواد والمجالات)
const SUBJECTS = [
  "البرمجة والذكاء الاصطناعي",
  "مادة البرمجة",
  "البرمجة النظري",
  "البرمجة العملي",
  "الخوارزميات وخرائط التدفق",
  "التفكير المنطقي وهياكل البيانات",
  "لغة بايثون Python",
  "لغة جافاسكريبت JavaScript",
  "تكنولوجيا المعلومات والاتصالات ICT",
  "الذكاء الاصطناعي التوليدي",
  "الرياضيات",
  "الجبر والهندسة الفراغية",
  "التفاضل والتكامل",
  "الاستاتيكا والديناميكا",
  "الفيزياء",
  "الكيمياء",
  "الأحياء",
  "العلوم المتكاملة",
  "امتحانات توفاس Tofas",
  "منهج كيريو Qureo الياباني"
];

// 4. Stages & Grades (المراحل والصفوف الدراسية)
const STAGES = [
  "أولى بكالوريا",
  "ثانية بكالوريا",
  "ثالثة بكالوريا",
  "طلاب البكالوريا",
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
  "الثانوية العامة",
  "المرحلة الثانوية",
  "مدارس المتفوقين STEM",
  "مدارس اللغات والتجريبي",
  "المسار العربي",
  "مسار اللغات Languages",
  "المرحلة الإعدادية",
  "الصف الثالث الإعدادي",
  "الصف الثاني الإعدادي",
  "الصف الأول الإعدادي",
  "المرحلة الابتدائية",
  "الشهادة الثانوية العامة بمصر"
];

// 5. Franco-Arabic & Common Keyboard Slips / Typos (أخطاء الكتابة والفرانكو الشائعة)
const FRANCO_AND_TYPOS = [
  "codeup egypt", "code up thanawya", "code-up thanawya", "barmaja thanawya", "qureo egypt", "qureo platform",
  "thanawya ai", "ai baccalaureate egypt", "thanawya amma programming", "qureo 1st sec", "codeup online",
  "ضعقثخ", "ضعقثخ بخسف", "زخيث عح", "زخيث-عح", "ggf;hg,vdh", "hgtvlm hgthk,dm", "hgfvl[m", "ydv ضعقثخ",
  "منصة كوداب", "كوداب منصة", "كود اب المنصة الاولى", "كوداب برمجة", "كود اب بكالوريا"
];

// 6. Long-Tail Search Queries (النية البحثية الدقيقة للطلاب وأولياء الأمور)
const LONG_TAIL_INTENTS = [
  "اضمن الدرجة النهائية في البرمجة النظري لطلاب البكالوريا والثانوية العامة",
  "ازاي اذاكر البرمجة النظري للامتحان الورقي في أولى ثانوي",
  "حل وتفكيك بنك أسئلة الوزارة في مادة البرمجة والذكاء الاصطناعي",
  "تطبيق أكواد بايثون وجافاسكريبت من الموبايل بدون لابتوب ومحرر مدمج",
  "طريقة كتابة خرائط التدفق Flowcharts وحل المسائل البرمجية للثانوي",
  "أفضل طريقة لمتابعة مستوى ابني في الكورسات ودرجات الامتحانات بالواتساب",
  "شرح منهج البرمجة الجديد بالكامل مع أفضل المدرسين في مصر",
  "مراجعة ليلة الامتحان النهائية في مادة تكنولوجيا المعلومات والبرمجة"
];

// 7. Parent & Feature Specific Phrases
const FEATURE_PHRASES = [
  "أفضل منصة متابعة لولي الأمر بالواتساب",
  "تقارير أداء الطلاب الأسبوعية لولي الأمر",
  "منصة تعليمية بدون تشتيت وبدون إعلانات",
  "منصة حماية الفيديو والعلامة المائية المتحركة",
  "نظام النقاط والمكافآت للطلاب المتفوقين",
  "لوحة شرف وتحفيز الطلاب Gamification",
  "أفضل محرر أكواد ذكي ومدمج In-App Compiler",
  "حرية اختيار وتعدد المدرسين لنفس المادة",
  "شرح البرمجة النظري للامتحانات الورقية",
  "شرح البرمجة والتطبيق العملي أونلاين",
  "شحن ودفع المحافظ الإلكترونية فودافون كاش وانستاباي",
  "أفضل بديل لمنصة كيريو وشرح المنهج المصري",
  "أقوى مراجعة ليلة الامتحان في البرمجة والذكاء الاصطناعي",
  "بنك أسئلة تفاعلي وتدريب على امتحانات التقييم",
  "شرح الخوارزميات ورسم خرائط التدفق خطوة بخطوة",
  "تطبيق الأكواد بدون برامج خارجية وبدون لابتوب من الموبايل"
];

// Generate Systematic Combinations
function generateKeywordMatrix(): string[] {
  const set = new Set<string>();

  // Add brand, franco, typos, and long-tail intents
  BRAND_TERMS.forEach((b) => set.add(b));
  FRANCO_AND_TYPOS.forEach((ft) => set.add(ft));
  LONG_TAIL_INTENTS.forEach((lt) => set.add(lt));
  FEATURE_PHRASES.forEach((f) => set.add(f));

  // Combinations: [Modifier] + [Subject]
  for (const m of MODIFIERS) {
    for (const sub of SUBJECTS) {
      set.add(`${m} ${sub}`);
    }
  }

  // Combinations: [Subject] + [Stage]
  for (const sub of SUBJECTS) {
    for (const st of STAGES) {
      set.add(`${sub} ${st}`);
      set.add(`${sub} لـ ${st}`);
    }
  }

  // Combinations: [Modifier] + [Subject] + [Stage]
  for (const m of MODIFIERS) {
    for (const sub of SUBJECTS) {
      for (const st of STAGES) {
        set.add(`${m} ${sub} لـ ${st}`);
        set.add(`${m} ${sub} ${st}`);
      }
    }
  }

  // Combinations: [Brand] + [Subject/Feature]
  for (const b of ["Code-UP", "كود اب", "منصة كود اب"]) {
    for (const sub of SUBJECTS) {
      set.add(`${b} ${sub}`);
      set.add(`${b} شرح ${sub}`);
    }
    for (const st of STAGES) {
      set.add(`${b} ${st}`);
    }
  }

  return Array.from(set);
}

export const SEO_KEYWORD_MATRIX = generateKeywordMatrix();

// Top priority 100 keywords for direct meta tags injection
export const TOP_META_KEYWORDS = SEO_KEYWORD_MATRIX.slice(0, 150);
