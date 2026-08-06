import { EducationalActionType } from "../types";

export interface ProactiveRecommendation {
  type: "lesson" | "quiz" | "revision" | "homework" | "flashcards" | "break" | "duration";
  title: string;
  reasoning: string;
  action: EducationalActionType;
  suggestedDurationMinutes?: number;
}

export class RecommendationEngine {
  public static generateRecommendations(
    studentId: string,
    availableTime: number = 45,
    weakTopics: string[] = [],
    recentQuizScore?: number
  ): ProactiveRecommendation[] {
    const recommendations: ProactiveRecommendation[] = [];

    // 1. Weak topic remediation check
    if (weakTopics.length > 0) {
      recommendations.push({
        type: "revision",
        title: `مراجعة مركزة لموضوع (${weakTopics[0]})`,
        reasoning: "لاحظنا وجود نسبة أخطاء سابقة في هذا الموضوع، ومراجعته الآن تعزز الجاهزية.",
        action: "REVISION",
        suggestedDurationMinutes: 15,
      });
    }

    // 2. High quiz performance check -> recommend next lesson
    if (recentQuizScore !== undefined && recentQuizScore >= 80) {
      recommendations.push({
        type: "lesson",
        title: "الانتفال للدرس التفاعلي التالي",
        reasoning: "أحرزت درجة ممتازة في الكويز الأخير مما يؤهلك لاستيعاب الدرس القادم.",
        action: "NEXT_LESSON",
        suggestedDurationMinutes: 20,
      });
    }

    // 3. Low quiz performance check -> recommend flashcards & practice
    if (recentQuizScore !== undefined && recentQuizScore < 60) {
      recommendations.push({
        type: "flashcards",
        title: "استخدام بطاقات الاستذكار السريع (Flashcards)",
        reasoning: "تثبيت المفاهيم والمصطلحات الأساسية يسهم في رفع الدرجة في المحاولة القادمة.",
        action: "FLASHCARDS",
        suggestedDurationMinutes: 10,
      });
    }

    // 4. Long study session check -> recommend break
    if (availableTime > 90) {
      recommendations.push({
        type: "break",
        title: "راحة ذهنية 10 دقائق (Pomodoro Break)",
        reasoning: "أخذ استراحة قصيرة يحافظ على أعلى معدل تركيز واستيعاب.",
        action: "RECOMMEND",
        suggestedDurationMinutes: 10,
      });
    }

    return recommendations;
  }
}
