import { EducationalActionType, EducationalIntent } from "../types";

export class IntentDetector {
  /**
   * Analyzes user request text and parameters to detect educational intent.
   */
  public detectIntent(
    userMessage: string,
    actionOverride?: EducationalActionType,
    params: Record<string, unknown> = {}
  ): EducationalIntent {
    if (actionOverride) {
      return {
        intentName: `Explicit_${actionOverride}`,
        action: actionOverride,
        confidence: 1.0,
        parameters: params,
      };
    }

    const text = userMessage.toLowerCase().trim();

    // Intent pattern matchers with confidence scoring
    if (this.containsAny(text, ["حل", "احسب", "النتيجة", "solve", "solution", "how to solve"])) {
      return { intentName: "Solve_Problem", action: "SOLVE", confidence: 0.95, parameters: params };
    }
    if (this.containsAny(text, ["فكرة", "تلميح", "مساعدة بدون حل", "hint", "clue", "give me a hint"])) {
      return { intentName: "Request_Hint", action: "HINT", confidence: 0.9, parameters: params };
    }
    if (this.containsAny(text, ["بسط", "سهل", "بسيط", "simplify", "easier", "explain simply"])) {
      return { intentName: "Simplify_Concept", action: "SIMPLIFY", confidence: 0.9, parameters: params };
    }
    if (this.containsAny(text, ["كويز", "اختبار قصير", "أسئلة", "quiz", "test me", "questions"])) {
      return { intentName: "Generate_Quiz", action: "QUIZ", confidence: 0.92, parameters: params };
    }
    if (this.containsAny(text, ["واجب", "تدريب", "homework", "assignment"])) {
      return { intentName: "Homework_Help", action: "HOMEWORK", confidence: 0.88, parameters: params };
    }
    if (this.containsAny(text, ["بطاقات", "فلاد كارد", "مصطلحات", "flashcard", "flashcards", "terms"])) {
      return { intentName: "Generate_Flashcards", action: "FLASHCARDS", confidence: 0.92, parameters: params };
    }
    if (this.containsAny(text, ["ملخص", "خص", "summary", "summarize", "recap"])) {
      return { intentName: "Summarize_Lesson", action: "SUMMARY", confidence: 0.95, parameters: params };
    }
    if (this.containsAny(text, ["مراجعة", "راجع", "review", "revision"])) {
      return { intentName: "Revision_Request", action: "REVISION", confidence: 0.87, parameters: params };
    }
    if (this.containsAny(text, ["قارن", "الفرق بين", "مقارنة", "compare", "difference between"])) {
      return { intentName: "Compare_Concepts", action: "COMPARE", confidence: 0.92, parameters: params };
    }
    if (this.containsAny(text, ["امتحان كامل", "اختبار تجريبي", "exam", "mock test"])) {
      return { intentName: "Generate_Exam", action: "EXAM", confidence: 0.9, parameters: params };
    }
    if (this.containsAny(text, ["خطة", "جدول", "دراسة", "plan", "schedule", "study plan"])) {
      return { intentName: "Create_Plan", action: "PLAN", confidence: 0.9, parameters: params };
    }
    if (this.containsAny(text, ["الدرس القادم", "ماذا بعد", "next lesson", "what next"])) {
      return { intentName: "Next_Lesson", action: "NEXT_LESSON", confidence: 0.85, parameters: params };
    }
    if (this.containsAny(text, ["طريقة للحفظ", "خدعة ذاكرة", "mnemonic", "memory trick"])) {
      return { intentName: "Memory_Trick", action: "MEMORY_TRICK", confidence: 0.91, parameters: params };
    }
    if (this.containsAny(text, ["شجعني", "تحفيز", "احباط", "motivate", "motivation"])) {
      return { intentName: "Motivate_Student", action: "MOTIVATE", confidence: 0.89, parameters: params };
    }
    if (this.containsAny(text, ["تقرير ولي الأمر", "تقرير الوالدين", "parent report"])) {
      return { intentName: "Parent_Report", action: "PARENT_REPORT", confidence: 0.95, parameters: params };
    }
    if (this.containsAny(text, ["تقرير المعلم", "أداء الطالب", "teacher report"])) {
      return { intentName: "Teacher_Report", action: "TEACHER_REPORT", confidence: 0.95, parameters: params };
    }
    if (this.containsAny(text, ["بحث في المنصة", "أين أجد", "search", "find lesson"])) {
      return { intentName: "Search_Platform", action: "SEARCH_PLATFORM", confidence: 0.88, parameters: params };
    }
    if (this.containsAny(text, ["تقدمي", "تحليل أدائي", "my progress", "analytics"])) {
      return { intentName: "Analyze_Progress", action: "ANALYZE_PROGRESS", confidence: 0.88, parameters: params };
    }
    if (this.containsAny(text, ["توصية", "ماذا ترشح", "recommend"])) {
      return { intentName: "Recommend", action: "RECOMMEND", confidence: 0.85, parameters: params };
    }

    // Default intent fallback
    return {
      intentName: "General_Explanation",
      action: "EXPLAIN",
      confidence: 0.7,
      parameters: params,
    };
  }

  private containsAny(source: string, keywords: string[]): boolean {
    return keywords.some((kw) => source.includes(kw));
  }
}
