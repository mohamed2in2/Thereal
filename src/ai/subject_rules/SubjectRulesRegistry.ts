export interface SubjectPedagogicalRule {
  subject: string;
  name: string;
  instructions: string[];
  formattingGuideline: string;
}

export class SubjectRulesRegistry {
  private static instance: SubjectRulesRegistry;
  private rules: Map<string, SubjectPedagogicalRule> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): SubjectRulesRegistry {
    if (!SubjectRulesRegistry.instance) {
      SubjectRulesRegistry.instance = new SubjectRulesRegistry();
    }
    return SubjectRulesRegistry.instance;
  }

  private registerDefaults(): void {
    // 1. Mathematics
    this.registerRule({
      subject: "رياضيات",
      name: "Mathematics Pedagogical Rules",
      instructions: [
        "اشرح دائماً السبب والمنطق الرياضي خلف القانون قبل تطبيق الأرقام.",
        "اكتب خطوات التعويض والحساب خطوة بخطوة دون اختصار الخطوات المفتاحية.",
        "سلط الضوء على الأخطاء والحيل الشائعة في الامتحانات (Exam Traps).",
        "قم بالتحقق من صحة الناتج النهائي ومنطقية النتيجة.",
      ],
      formattingGuideline: "استخدم المعادلات بدلاً من الفقرات، واستخدم صيغ LaTeX أو التنسيق الرياضي الواضح.",
    });

    // 2. Physics
    this.registerRule({
      subject: "فيزياء",
      name: "Physics Pedagogical Rules",
      instructions: [
        "ابدأ بالقانون الفيزيائي الأساسي والظاهرة المرتبطة به.",
        "وضح دلالة كل متغير في القانون (Symbol & Variable).",
        "حدد وحدات القياس الرسمية (SI Units) لكل عنصر.",
        "عوض بالأرقام وتابع الاختصارات الرياضية.",
        "تحقق من وحدة الناتج النهائي واشرح المعنى الفيزيائي للنتيجة.",
      ],
      formattingGuideline: "اكتب القوانين والوحدات في سطر مستقل وواضح مع توضيح الرموز.",
    });

    // 3. Chemistry
    this.registerRule({
      subject: "كيمياء",
      name: "Chemistry Pedagogical Rules",
      instructions: [
        "ركز على الفهم المفهومي والتفاعل قبل كتابة المعادلة الكيميائية.",
        "اشرح سبب حدوث التفاعل وحركة الإلكترونات وتكون الروابط كلما كان ذلك مناسباً.",
        "قلل الحفظ واستخدم الأنماط والعائلات الكيميائية لربط المفاهيم.",
        "وضح شروط التفاعل (حرارة، ضغط، عوامل حفازة).",
      ],
      formattingGuideline: "تنسيق المعادلات الكيميائية والحالات الفيزيائية بشكل منظم ومباشر.",
    });

    // 4. Biology
    this.registerRule({
      subject: "أحياء",
      name: "Biology Pedagogical Rules",
      instructions: [
        "اشرح العمليات الحيوية خطوة بخطوة بحسب التسلسل الزمني والحيوي.",
        "اربط العضو/التركيب دائماً بالوظيفة الحيوية التي يؤديها (Structure to Function).",
        "وضح علاقة السبب والنتيجة في الاستجابات والعمليات الحيوية.",
        "تجنب سرد الحقائق المعزولة بدون ربط بأجهزة الجسم والمنظومة الحيوية.",
      ],
      formattingGuideline: "استخدم مخططات النقاط المتسلسلة لإظهار تسلسل العمليات الحيوية.",
    });

    // 5. Arabic
    this.registerRule({
      subject: "لغة عربية",
      name: "Arabic Grammar & Language Rules",
      instructions: [
        "اشرح القواعد النحوية والصرفية من خلال تحليل تركيب الجملة وتحديد الأركان.",
        "وضح المعنى والدلالة قبل تطبيق القاعدة النحوية.",
        "قدم مثالاً تطبيقياً نصياً واحداً وشديد الوضوح.",
        "نبه الطالب إلى أخطاء الإعراب الشائعة وفخاخ امتحانات اللغة العربية.",
      ],
      formattingGuideline: "استخدم التشكيل والألوان/التغليظ للإبرام والموقع النحوي للكلمات.",
    });

    // 6. English
    this.registerRule({
      subject: "لغة إنجليزية",
      name: "English Pedagogical Rules",
      instructions: [
        "ابدأ بالمعاني والمفردات أولاً (Vocabulary first).",
        "اشرح القاعدة النحوية ثانياً (Grammar second).",
        "وضح السياق والاستخدام الطبيعي ثالثاً (Context third).",
        "تضمن دائماً جملة نموذجية واقعية وطبيعية الاستخدام (Natural Example Sentence).",
      ],
      formattingGuideline: "قدم الكلمة والقاعدة بالإنجليزية مع التوضيح بالعربية في جدول أو نقاط سهلة.",
    });

    // 7. History
    this.registerRule({
      subject: "تاريخ",
      name: "History Pedagogical Rules",
      instructions: [
        "ركز على الأسباب والظروف التي أدت للحدث التاريخي.",
        "استعرض الأحداث بتسلسل منطقي ورؤية شاملة.",
        "وضح النتائج والتداعيات التاريخية والارتباطات بين الأحداث.",
        "تجنب التركيز على حفظ التواريخ الجافة إلا إذا كانت محورية في التقييم.",
      ],
      formattingGuideline: "سلسلة زمنية (Timeline) في نقاط: الأسباب -> الحدث -> النتائج.",
    });

    // 8. Geography
    this.registerRule({
      subject: "جغرافيا",
      name: "Geography Pedagogical Rules",
      instructions: [
        "اشرح العلاقات المكانية والتفاعل بين الإنسان والبيئة.",
        "اربط الموقع بالخريطة والمناخ والأنشطة الاقتصادية والسكانية.",
        "تجنب قائمة الحقائق المعزولة؛ اربط الظاهرة بأسسبابها الجغرافية.",
      ],
      formattingGuideline: "استخدم النقاط والمقارنات المكانية بين الأقاليم والظواهر.",
    });

    // 9. Computer Science & Programming
    this.registerRule({
      subject: "برمجه عملي",
      name: "Computer Science & Programming Rules",
      instructions: [
        "علم المنطق والتفكير الخوارزمي قبل الصياغة البرمجية (Logic before syntax).",
        "بسط الخوارزميات وتخيل حركة البيانات بأسلوب بصري خطوة بخطوة.",
        "فكك المشاكل الكبيرة إلى دالّات وموديولات صغيرة سهلة التطبيق.",
        "تجنب إغراق الطالب المبتدئ بالمفاهيم المعقدة دفعة واحدة.",
      ],
      formattingGuideline: "أكواد برمجية منظمة، قصيرة، ومعلقة بأسلوب Clean Code.",
    });

    // 10. Official Egyptian Curriculum: Programming & Artificial Intelligence
    this.registerRule({
      subject: "البرمجة والذكاء الاصطناعي",
      name: "Programming and Artificial Intelligence Curriculum Rules",
      instructions: [
        "الالتزام بالمفاهيم المعتمدة في منهج البكالوريا المصرية (الصف الثاني الثانوي - الترمين الأول والثاني).",
        "تغطية فصول المنهج السبعة: تكنولوجيا المجتمع، الأمن السيبراني، تطبيقات الويب، تصميم الوسائط، جمع وتنقية البيانات، الاستدلال والانحدار، والتعلم الآلي والعميق ونماذج اللغة.",
        "التركيز على الفهم المفاهيمي، والربط العملي بالواقع، وتوضيح المحاذير الأخلاقية والأمنية ومبدأ (مدخلات خاطئة = مخرجات خاطئة).",
        "عند مناقشة أسئلة الامتحانات والتمارين: توجيه الطالب خطوة بخطوة وتقديم التفسيرات العلمية المستندة لكتاب الوزارة.",
      ],
      formattingGuideline: "استخدم النقاط الواضحة والجداول والمقارنات التوضيحية مع الإشارة لمفاهيم المنهج بدقة.",
    });
  }

  public registerRule(rule: SubjectPedagogicalRule): void {
    this.rules.set(rule.subject, rule);
  }

  public getRule(subject: string): SubjectPedagogicalRule {
    const matchedSubject = this.findSubjectKey(subject);
    return (
      this.rules.get(matchedSubject) || {
        subject: matchedSubject,
        name: "General Pedagogical Rules",
        instructions: [
          "تقديم شرح مبسط ومنظم يتناسب مع المرحلة الدراسية للطالب.",
          "التركيز على الفهم والتطبيق بدلاً من الحفظ والمراكمة.",
        ],
        formattingGuideline: "استخدم التنسيق المنظم والنقاط الواضحة.",
      }
    );
  }

  public getFormattedRules(subject: string): string {
    const rule = this.getRule(subject);
    return [
      `=== قواعد التدريس الخاصة بمادة (${rule.subject}) ===`,
      ...rule.instructions.map((ins) => `- ${ins}`),
      `=== دليل التنسيق لمادة (${rule.subject}) ===`,
      `- ${rule.formattingGuideline}`,
    ].join("\n");
  }

  private findSubjectKey(subject: string): string {
    const s = subject.toLowerCase();
    if (s.includes("ذكاء") || s.includes("اصطناعي") || s.includes("ai") || s.includes("curriculum") || s.includes("منهج") || s.includes("بكالوريا")) return "البرمجة والذكاء الاصطناعي";
    if (s.includes("رياضيات") || s.includes("math")) return "رياضيات";
    if (s.includes("فيزياء") || s.includes("physics")) return "فيزياء";
    if (s.includes("كيمياء") || s.includes("chemistry")) return "كيمياء";
    if (s.includes("أحياء") || s.includes("احياء") || s.includes("biology")) return "أحياء";
    if (s.includes("عرب") || s.includes("نحو") || s.includes("arabic")) return "لغة عربية";
    if (s.includes("انجليز") || s.includes("إنجليز") || s.includes("english")) return "لغة إنجليزية";
    if (s.includes("تاريخ") || s.includes("history")) return "تاريخ";
    if (s.includes("جغراف") || s.includes("geography")) return "جغرافيا";
    if (s.includes("برمجه") || s.includes("حاسب") || s.includes("code") || s.includes("cs")) return "برمجه عملي";
    return "البرمجة والذكاء الاصطناعي";
  }
}
