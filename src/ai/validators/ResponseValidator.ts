import { ValidationResult } from "../types";

export class ResponseValidator {
  private unsafeKeywords = [
    "nsfw",
    "violence",
    "illegal",
    "hack_admin_password",
    "bypass_auth_token",
  ];

  private hallucinationIndicators = [
    "[INSERT_RESPONSE_HERE]",
    "As an AI, I cannot access data",
    "I do not have real time data",
    "UNDEFINED_VALUE",
    "[TODO]",
  ];

  /**
   * Validates LLM output against safety, quality, formatting, and relevance standards.
   */
  public validate(content: string, expectedLanguage = "ar"): ValidationResult {
    // 1. Empty Check
    if (!content || content.trim().length === 0) {
      return {
        isValid: false,
        errorType: "empty",
        reason: "Response content is completely empty.",
        score: 0,
      };
    }

    const trimmed = content.trim();

    // 2. Unsafe Content Check
    const lowerContent = trimmed.toLowerCase();
    for (const kw of this.unsafeKeywords) {
      if (lowerContent.includes(kw)) {
        return {
          isValid: false,
          errorType: "unsafe",
          reason: `Content contains forbidden unsafe keyword '${kw}'.`,
          score: 0,
        };
      }
    }

    // 3. Hallucination Indicator Check
    for (const indicator of this.hallucinationIndicators) {
      if (trimmed.includes(indicator)) {
        return {
          isValid: false,
          errorType: "hallucination",
          reason: `Content contains hallucination indicator '${indicator}'.`,
          score: 0.3,
        };
      }
    }

    // 4. Educational Relevance Check
    if (trimmed.length < 10) {
      return {
        isValid: false,
        errorType: "relevance",
        reason: "Response is too short to provide educational value.",
        score: 0.4,
      };
    }

    // 5. Language Check heuristic
    if (expectedLanguage === "ar") {
      const arabicCharCount = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = trimmed.length;
      // If code blocks dominate, allow lower Arabic ratio, otherwise require at least some Arabic
      const hasCodeBlock = trimmed.includes("```");
      if (!hasCodeBlock && totalChars > 50 && arabicCharCount / totalChars < 0.15) {
        return {
          isValid: false,
          errorType: "language",
          reason: "Response does not match expected primary language (Arabic).",
          score: 0.5,
          sanitizedContent: trimmed,
        };
      }
    }

    return {
      isValid: true,
      score: 1.0,
      sanitizedContent: trimmed,
    };
  }

  public getGracefulFallback(reason?: string): string {
    return (
      `### ملاحظة تعليمية\n\n` +
      `نعتذر، لم نتمكن من توليد الإجابة بالشكل المطلوب في هذه اللحظة (${reason || "استجابة غير مكتملة"}).\n\n` +
      `يرجى إعادة محاولة الطلب أو التأكد من إدخال المفهوم المطلوب بوضوح.`
    );
  }
}
