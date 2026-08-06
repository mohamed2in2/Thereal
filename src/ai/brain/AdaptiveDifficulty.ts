import { QuizHistoryItem } from "../types";

export type StudentLevel = "Beginner" | "Intermediate" | "Advanced" | "Unknown";

export interface LevelGuidelines {
  level: StudentLevel;
  description: string;
  instructions: string[];
  maxConceptFocus: number;
}

export class AdaptiveDifficulty {
  public static estimateLevel(
    quizHistory: QuizHistoryItem[] = [],
    studentGrade?: string,
    userText: string = ""
  ): StudentLevel {
    if (quizHistory.length === 0) {
      // Analyze text heuristics if no quiz history is present
      const lower = userText.toLowerCase();
      if (lower.includes("مبتدئ") || lower.includes("من البداية") || lower.includes("شرح من الصفر")) {
        return "Beginner";
      }
      if (lower.includes("متقدم") || lower.includes("تحدي") || lower.includes("سؤال صلب")) {
        return "Advanced";
      }
      return "Intermediate"; // Unknown defaults to Intermediate per specs
    }

    // Compute average score from recent quizzes
    const recentQuizzes = quizHistory.slice(-5);
    const averageScore =
      recentQuizzes.reduce((sum, q) => sum + q.score, 0) / recentQuizzes.length;

    if (averageScore >= 85) {
      return "Advanced";
    } else if (averageScore >= 60) {
      return "Intermediate";
    } else {
      return "Beginner";
    }
  }

  public static getGuidelines(level: StudentLevel): LevelGuidelines {
    switch (level) {
      case "Beginner":
        return {
          level: "Beginner",
          description: "مستوى تأسيسي مبتدئ",
          instructions: [
            "استخدم لغة بسيطة واضحة جداً ودون مصطلحات معقدة.",
            "قدم شروحات قصيرة ومكثفة مع التكثيف من الأمثلة التوضيحية.",
            "ركز على مفهوم واحد فقط في كل استجابة.",
            "قم بعمل ملخصات سريعة ومستمرة لتأكيد الاستيعاب.",
          ],
          maxConceptFocus: 1,
        };
      case "Advanced":
        return {
          level: "Advanced",
          description: "مستوى متقدم ومتمكن",
          instructions: [
            "قدم شروحات مباشرة وموجزة دون الإطالة في البدايات.",
            "ركز على المنطق التحليلي والأسباب العميقة (Reasoning).",
            "سلط الضوء على فخاخ الامتحانات الصعبة والأسئلة غير التقليدية.",
            "اطرح سؤال تحدٍ (Challenge Question) في نهاية الشرح.",
          ],
          maxConceptFocus: 3,
        };
      case "Intermediate":
      case "Unknown":
      default:
        return {
          level: "Intermediate",
          description: "مستوى متوسط متوازن",
          instructions: [
            "استخدم لغة تعليمية قياسية متوازنة.",
            "قدم مثالاً تطبيقياً واحداً وواضحاً.",
            "اطرح سؤال ممارسة وتأكيد واحد (One Practice Question).",
          ],
          maxConceptFocus: 2,
        };
    }
  }

  public static getPromptInstructions(level: StudentLevel): string {
    const g = this.getGuidelines(level);
    return [
      `=== مستوى الطالب المعتمد: (${g.level}) ===`,
      ...g.instructions.map((ins) => `- ${ins}`),
    ].join("\n");
  }
}
