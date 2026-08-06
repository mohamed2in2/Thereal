import { SubjectKnowledge } from "../types";

export class KnowledgeLoader {
  private baseIdentityRules = [
    "أنت المساعد التعليمي الذكي لمنصة Code-UP التعليمية.",
    "دورك هو تمكين الطالب وتنمية مهارات التفكير المنطقي والتحليلي بنفسه.",
    "الالتزام بالقيم التربوية والدعم التشجيعي المستمر.",
  ];

  private baseTeachingRules = [
    "اعتماد طريقة سقراط الذكية في التدرج بالطرح.",
    "تجنب إعطاء إجابة مضللة أو غير مفحوصة.",
    "استخدام لغة عربية فصيحة ومبسطة وتناسب استيعاب الطالب.",
  ];

  private baseFormattingRules = [
    "استخدام تنسيق Markdown الواضح للنصوص والعناوين.",
    "تنسيق الأكواد البرمجية داخل fenced code blocks مع تحديد اللغات.",
    "استخدام الجداول والبطاقات والقوائم المنظمة.",
  ];

  private subjectRuleMap: Record<string, string[]> = {
    "برمجه عملي": [
      "التركيز على التطبيق البرمجي والممارسة العملية.",
      "كتابة أكواد نظيفة ومعلقة بأسلوب محترف (Clean Code).",
      "شرح الأخطاء البرمجية الشائعة (Syntax & Logical Errors) وكيفية تلافيها.",
    ],
    "نظري": [
      "التركيز على المفاهيم الهيكلية والأنظمة وتصميم الخوارزميات.",
      "ربط النظرية بالتطبيق البرمجي الفعلي.",
    ],
    "مشاريع": [
      "تفكيك المشروع إلى خطوات إنجاز محددة.",
      "مراعاة متطلبات التصميم والتجربة وتتبع الإنجاز.",
    ],
    "رياضيات": [
      "خطوات متسلسلة للحل مع كتابة المعادلات بدقة.",
      "التأكد من صحة الحسابات والأرقام.",
    ],
    "علوم": [
      "ربط الظواهر العلمية بالبيئة والتجارب المعملية.",
    ],
  };

  /**
   * Loads ONLY relevant domain & subject rules based on requested subject.
   * Strictly excludes non-relevant domain rules (e.g. Chemistry, Biology).
   */
  public loadKnowledge(subject: string): SubjectKnowledge {
    const matchedSubject = this.findMatchingSubjectKey(subject);
    const specificRules = this.subjectRuleMap[matchedSubject] || [
      "شرح مبسط ومباشر لمواضيع المادة المطلوبة.",
    ];

    return {
      subject: matchedSubject,
      identityRules: [...this.baseIdentityRules],
      teachingRules: [...this.baseTeachingRules],
      subjectRules: specificRules,
      formattingRules: [...this.baseFormattingRules],
    };
  }

  public getRulesString(subject: string): string {
    const knowledge = this.loadKnowledge(subject);
    return [
      `=== قواعد الهوية (${knowledge.subject}) ===`,
      ...knowledge.identityRules.map((r) => `- ${r}`),
      `=== قواعد التدريس ===`,
      ...knowledge.teachingRules.map((r) => `- ${r}`),
      `=== قواعد المادة (${knowledge.subject}) ===`,
      ...knowledge.subjectRules.map((r) => `- ${r}`),
      `=== قواعد التنسيق ===`,
      ...knowledge.formattingRules.map((r) => `- ${r}`),
    ].join("\n");
  }

  private findMatchingSubjectKey(subject: string): string {
    const s = subject.toLowerCase();
    if (s.includes("برمجه") || s.includes("code") || s.includes("programming")) return "برمجه عملي";
    if (s.includes("نظري") || s.includes("theory")) return "نظري";
    if (s.includes("مشروع") || s.includes("project")) return "مشاريع";
    if (s.includes("رياضيات") || s.includes("math")) return "رياضيات";
    if (s.includes("علوم") || s.includes("science")) return "علوم";
    return "برمجه عملي";
  }
}
