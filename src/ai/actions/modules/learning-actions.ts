import { BaseAction } from "../BaseAction";
import { AIContext, EducationalActionType, ResponseFormatType } from "../../types";

// 1. EXPLAIN
export class ExplainAction extends BaseAction {
  public type: EducationalActionType = "EXPLAIN";
  public name = "الشرح التعليمي التفصيلي";
  public description = "تقديم شرح واضح ومفصل ومبسط للمفهوم المطلوب مع أمثلة عملية.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Educational Explanation")}
- قدم شرحاً مفسراً ومباشراً يناسب المرحلة الدراسية (${context.currentGrade}).
- ابدأ بالتعريف الأساسي، ثم الانتقال للأجزاء العملية.
- استخدم أمثلة توضيحية من الواقع أو البرمجة.
- اختم بنصيحة دراسية لترسيخ المفهوم.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "explanation";
  }
}

// 2. SIMPLIFY
export class SimplifyAction extends BaseAction {
  public type: EducationalActionType = "SIMPLIFY";
  public name = "تبسيط المفهوم المعقد";
  public description = "إعادة صياغة الشرح المعقد بأسلوب مبسط للغاية واستخدام تشبيهات قريبة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Concept Simplification")}
- اشرح المفهوم كأنك تشرحه لشخص مبتدئ تماماً بدون مصطلحات معقدة.
- استخدم تشبيهات من الحياة اليومية (Analogies).
- جزّء الفكرة إلى 3 نقاط بسيطة جداً.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "bullets";
  }
}

// 3. SOLVE
export class SolveAction extends BaseAction {
  public type: EducationalActionType = "SOLVE";
  public name = "حل المسائل والتمارين";
  public description = "تقديم حل كامل ومفصل خطوة بخطوة مع توضيح الفكرة خلف كل خطوة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Step-by-Step Solution")}
- حل المشكلة المعروضة خطوة بخطوة بترتيب منطقي.
- اشرح السبب والمنطق خلف كل خطوة.
- حدد النتيجة النهائية بوضوح في نهاية الإجابة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "equations";
  }
}

// 4. HINT
export class HintAction extends BaseAction {
  public type: EducationalActionType = "HINT";
  public name = "إعطاء تلميح دون كشف الحل";
  public description = "تقديم توجيه ذكي يساعد الطالب على التفكير وحل المسألة بنفسه دون إعطاء الحل الكامل.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Smart Educational Hint")}
- لا تعطِ الحل النهائي إطلاقاً!
- وجّه نظر الطالب إلى الخطوة الأولى أو المتغير المفتاحي الذي يحتاج التفكير فيه.
- اطرح سؤالاً توجيهياً يساعد الطالب على الاكتشاف بنفسه.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "bullets";
  }
}

// 5. QUIZ
export class QuizAction extends BaseAction {
  public type: EducationalActionType = "QUIZ";
  public name = "توليد أسئلة واختبارات قصيرة";
  public description = "إنشاء أسئلة خيارات متعددة لتحديد مدى فهم الطالب للمفهوم.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Quiz Generation")}
- صمم 3 أسئلة خيارات متعددة (MCQ) ذات جودة عالية.
- قدم 4 خيارات لكل سؤال (أ، ب، ج، د) مع خيار واحد صحيح فقط.
- حدد الإجابة الصحيحة وشرح مختصر لسبب صحتها.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "quiz_cards";
  }
}

// 6. HOMEWORK
export class HomeworkAction extends BaseAction {
  public type: EducationalActionType = "HOMEWORK";
  public name = "مساعدة واجبات وتدريبات منزلية";
  public description = "مساعدة الطالب في فهم الواجب وتفكيك متطلباته إلى مهام صغيرة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Homework Assistance")}
- حلل متطلبات الواجب بالتفصيل.
- قسم الواجب إلى خطوات تنفيذية صغيرة متتابعة.
- قدم نصائح وموارد مساعدة لإنجاز كل خطوة بنجاح.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 7. REVIEW
export class ReviewAction extends BaseAction {
  public type: EducationalActionType = "REVIEW";
  public name = "مراجعة الحل وتقييم الأداء";
  public description = "فحص حل الطالب وتحديد النقاط الصحيحة والأخطاء إن وجدت مع تصحيحها.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Solution Review & Feedback")}
- افحص كود أو حل الطالب بعناية.
- اذكر النقاط الإيجابية في الحل أولاً.
- حدد أي أخطاء أو تحسينات ممكنة مع إعطاء النصيحة الصحيحة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 8. FLASHCARDS
export class FlashcardsAction extends BaseAction {
  public type: EducationalActionType = "FLASHCARDS";
  public name = "بطاقات استذكار سريع";
  public description = "توليد بطاقات ذاكرة سريعة تشتمل على المصطلحات والتعريفات المفتاحية.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Flashcards Generation")}
- أنشئ مجموعة من بطاقات الاستذكار (Flashcards).
- كل بطاقة تتكون من: (المصطلح / السؤال) و (التعريف / الإجابة المركزية).
- اضبط الصياغة لتكون مركزة ومناسبة للحفظ والمراجعة السريعة.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "flashcards";
  }
}

// 9. SUMMARY
export class SummaryAction extends BaseAction {
  public type: EducationalActionType = "SUMMARY";
  public name = "ملخص الدرس";
  public description = "تكثيف معلومات الدرس في ملخص شامل ومرتب بأسلوب النقاط المفتاحية.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Lesson Summary")}
- لخص الدرس في نقاط واضحة ومكثفة.
- ابرز المفاهيم الأساسية والمعادلات/الأوامر البرمجية الأهم.
- اجعل الملخص سهلاً للمراجعة السريعة قبل الاختبارات.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "summary";
  }
}

// 10. REVISION
export class RevisionAction extends BaseAction {
  public type: EducationalActionType = "REVISION";
  public name = "مراجعة شاملة للمادة";
  public description = "خطة مراجعة مركزة تضمن ربط النقاط الضعيفة بالقوية وتثبيت المعلومات.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Comprehensive Revision")}
- ركز على النقاط الضعيفة المسجلة للطالب: (${context.weakChapters.join(", ") || "جميع المواضيع"}).
- قدم ملخصات سريعة وتدريبات تثبيتية.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }
}

// 11. COMPARE
export class CompareAction extends BaseAction {
  public type: EducationalActionType = "COMPARE";
  public name = "مقارنة بين مفهومين أو خيارين";
  public description = "إجراء مقارنة موضوعية ومنظمة بين مفهومين تعليميين مع جدول مقارنة.";

  public getPromptInstructions(context: AIContext): string {
    return `${this.formatHeader("Concept Comparison")}
- قارن بين المفهومين المطلوبين بوضوح.
- اذكر نقاط التشابه والاختلاف ومتى يتم استخدام كل منهما.
- صمم جدول مقارنة شامل للتلخيص.`;
  }

  public override getPreferredFormat(): ResponseFormatType {
    return "tables";
  }
}
