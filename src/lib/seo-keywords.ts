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

// 5. Parent & Feature Specific Phrases
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

  // Add brand terms
  BRAND_TERMS.forEach((b) => set.add(b));
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
