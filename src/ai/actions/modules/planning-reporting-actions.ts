import { BaseAction } from "../BaseAction";
import { AIContext, EducationalActionType, ResponseFormatType } from "../../types";

// 12. EXAM
export class ExamAction extends BaseAction {
  public type: EducationalActionType = "EXAM";
  public name = "توليد امتحان تجريبي شامل";
  public description = "إنشاء نموذج اختبار تجريبي يحاكي امتحانات المادة مع توزيع الدرجات.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Mock Exam Generation")}
- أنشئ نموذج اختبار تجريبي متكامل يغطي المنهج للمرحلة (${context.currentGrade}).
- قسم الامتحان إلى أسئلة اختيارات، وأسئلة مقالية/برمجية قصيرة.
- ضع نموذج الإجابة وتوزيع الدرجات في النهاية.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 13. PLAN
export class PlanAction extends BaseAction {
  public type: EducationalActionType = "PLAN";
  public name = "خطة دراسية شخصية";
  public description = "صياغة جدول دراسي مخصص بناءً على الوقت المتاح ونقاط الضعف والقوة للطالب.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Personalized Study Plan")}
- صمم جدولاً دراسياً مخصصاً للطالب بناءً على الوقت المتاح (${context.availableTime} دقيقة).
- خصص وقتاً أكبر للدروس الضعيفة: (${context.weakChapters.join(", ") || "لا يوجد"}).
- راعِ التنوع بين مشاهدة الدروس والتطبيق والتستات.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "study_plan";
  }
}

// 14. NEXT_LESSON
export class NextLessonAction extends BaseAction {
  public type: EducationalActionType = "NEXT_LESSON";
  public name = "توجيه للدرس القادم";
  public description = "تحديد الدرس القادم الأنسب للطالب والتمهيد لموضوعاته ومفاهيمه.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Next Lesson Recommendation")}
- حدد الدرس الموصى به بعد الدرس الحالي (${context.lesson.title || "الدرس الحالي"}).
- أعطِ الطالب تمهيداً موجزاً وجذاباً عن المفاهيم التي سيتعلمها في الدرس الجديد.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 15. RECOMMEND
export class RecommendAction extends BaseAction {
  public type: EducationalActionType = "RECOMMEND";
  public name = "توصية تعليمية مخصصة";
  public description = "تقديم ترشيحات للمصادر والممارسة المناسبة لنمط تعلم الطالب.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Personalized Recommendation")}
- بناءً على نمط التعلم المفضل للطالب (${context.learningPreference}):
- رشح أفضل الطرق والأنشطة لتعزيز الاستيعاب والمهارة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "bullets";
  }
}

// 16. MEMORY_TRICK
export class MemoryTrickAction extends BaseAction {
  public type: EducationalActionType = "MEMORY_TRICK";
  public name = "خدعة الذاكرة والربط التداعي";
  public description = "تقديم طرق مبتكرة ورموز اختصار لتسهيل تذكر المصطلحات والقوانين الصعبة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Mnemonic & Memory Trick")}
- ابتكر طريقة تداعي ذكي أو اختصار حرفي (Mnemonic) لتذكر هذا المفهوم بسهولة.
- اربط الفكرة بقصة قصيرة أو كلمة مفتاحية سهلة الحفظ.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "example";
  }
}

// 17. MOTIVATE
export class MotivateAction extends BaseAction {
  public type: EducationalActionType = "MOTIVATE";
  public name = "تشجيع وتحفيز الطالب";
  public description = "تقديم رسالة تحفيزية داعمة تدفع الطالب للاستمرار والتميز الدراسية.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Student Motivation & Encouragement")}
- وجه رسالة إيجابية ومحفزة للطالب (${context.student.name}).
- قدر المجهود المبذول وذكّره بالهدف والنمو المستمر في أدائه.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 18. ANALYZE_PROGRESS
export class AnalyzeProgressAction extends BaseAction {
  public type: EducationalActionType = "ANALYZE_PROGRESS";
  public name = "تحليل الأداء والتقدم الدراسي";
  public description = "تحليل شامل لنتائج الطالب في الاختبارات والواجبات ونسبة إنجاز المنهج.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Progress Analytics")}
- قدم تحليلاً دقيقاً لتقدم الطالب في الكورس (${context.course.title}).
- حلل نتائج الاختبارات التاريخية والدروس المكتملة والنقاط القوية والضعيفة.
- حدد مجالات التحسين المستهدفة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 19. PARENT_REPORT
export class ParentReportAction extends BaseAction {
  public type: EducationalActionType = "PARENT_REPORT";
  public name = "تقرير ولي الأمر";
  public description = "صياغة تقرير واضح وموجز لولي الأمر يوضح مستوى وتقدم وسلوك الطالب التعلّمي.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Parent Progress Report")}
- صغ تقريراً مهنياً وواضحاً لولي أمر الطالب (${context.student.name}).
- لخص نسبة إنجاز الدروس، الدرجات في الكويزات، والالتزام بالواجبات والتوصيات الأسرية.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "summary";
  }
}

// 20. TEACHER_REPORT
export class TeacherReportAction extends BaseAction {
  public type: EducationalActionType = "TEACHER_REPORT";
  public name = "تقرير المعلم المستفيض";
  public description = "تقرير فني للمعلم عن حالة الطالب الأكاديمية والنقاط التي تحتاج تدخلاً تربوياً.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Teacher Academic Report")}
- صغ تقريراً أكاديمياً فتنياً للمعلم حول الطالب (${context.student.name}).
- اذكر المفاهيم غير المستوعبة بدقة والنقاط التي تحتاج إعادة شرح في الحصة المقبلة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 21. SEARCH_PLATFORM
export class SearchPlatformAction extends BaseAction {
  public type: EducationalActionType = "SEARCH_PLATFORM";
  public name = "البحث في منصة Code-UP";
  public description = "مساعدة الطالب في إيجاد الدروس أو الواجبات أو الأسئلة السابقة داخل المنصة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Platform Search Guidance")}
- وجه الطالب للوصول إلى المكان الدقيق داخل المنصة للدرس أو المورد المطلوبة.
- حدد المسار والتصنيف المناسب داخل الكورس الحالي (${context.course.title}).`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "bullets";
  }
}
