export interface ErrorAnalysisResult {
  exactMistake: string;
  rootCause: string;
  correctReasoning: string;
  twinQuestion: string;
  patternDetected?: string;
}

export class ErrorAnalyzer {
  public static getPromptInstructions(): string {
    return [
      `=== تحليل الأخطاء التعليمي (Educational Error Analysis) ===`,
      `عند إجابة الطالب بشكل غير صحيح:`,
      `1. حدد الخطأ الدقيق في إجابة الطالب دون تجريح.`,
      `2. اشرح السبب الفعلي لوقوع الخطأ (Root Cause).`,
      `3. قدم المنطق والتفكير الصحيح الذي يجب اتباعه.`,
      `4. أنشئ سؤالاً شبيهاً تماماً (Twin Question) للتأكد من تجاوز الخطأ.`,
      `5. إذا تكرر نفس الخطأ، نبه الطالب للنمط المتكرر وكيفية التخلص منه.`,
    ].join("\n");
  }

  public static formatAnalysis(result: ErrorAnalysisResult): string {
    let text = `### 🔍 تحليل الخطأ وتصحيح المسار\n\n` +
      `- **الخطأ المكتشف**: ${result.exactMistake}\n` +
      `- **سبب وقوع الخطأ**: ${result.rootCause}\n` +
      `- **التفكير والمنطق الصحيح**: ${result.correctReasoning}\n\n`;

    if (result.patternDetected) {
      text += `> [!WARNING]\n` +
        `> **ملاحظة النمط المتكرر**: ${result.patternDetected}\n\n`;
    }

    text += `#### 🎯 سؤال تدريب مماثل للتأكيد:\n${result.twinQuestion}`;

    return text;
  }
}
