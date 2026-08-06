import { EducationalActionType } from "../types";
import { StudentLevel } from "../brain/AdaptiveDifficulty";

export interface ContinuousObservation {
  estimatedStudentLevel: StudentLevel;
  estimatedUnderstanding: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0
  observedWeakTopics: string[];
  observedStrongTopics: string[];
  recommendedNextAction: EducationalActionType;
  summaryObservation: string;
}

export class StudentObservationEngine {
  /**
   * Generates structured observations of student learning state after processing a request.
   */
  public static generateObservation(
    userMessage: string,
    action: EducationalActionType,
    currentLevel: StudentLevel,
    responseSuccess: boolean,
    weakTopics: string[] = [],
    strongTopics: string[] = []
  ): ContinuousObservation {
    let estimatedUnderstanding = 0.8;
    let confidenceScore = 0.85;
    let recommendedNextAction: EducationalActionType = "NEXT_LESSON";

    const text = userMessage.toLowerCase();

    // Adjust understanding score based on intent & success signals
    if (!responseSuccess) {
      estimatedUnderstanding = 0.4;
      recommendedNextAction = "HINT";
    } else if (action === "SOLVE" || action === "EXPLAIN") {
      estimatedUnderstanding = 0.75;
      recommendedNextAction = "QUIZ";
    } else if (action === "QUIZ" || action === "EXAM") {
      estimatedUnderstanding = 0.85;
      recommendedNextAction = "SUMMARY";
    } else if (action === "HINT" || action === "SIMPLIFY") {
      estimatedUnderstanding = 0.65;
      recommendedNextAction = "EXPLAIN";
    }

    if (text.includes("لم أفهم") || text.includes("صعبة") || text.includes("معقدة")) {
      estimatedUnderstanding = 0.5;
      confidenceScore = 0.6;
      recommendedNextAction = "SIMPLIFY";
    } else if (text.includes("فهمت") || text.includes("واضحة") || text.includes("سهلة")) {
      estimatedUnderstanding = 0.95;
      confidenceScore = 0.95;
      recommendedNextAction = "QUIZ";
    }

    return {
      estimatedStudentLevel: currentLevel,
      estimatedUnderstanding,
      confidenceScore,
      observedWeakTopics: weakTopics,
      observedStrongTopics: strongTopics,
      recommendedNextAction,
      summaryObservation: `الطالب استوعب الإجراء (${action}) بمستوى تقريبي (${Math.round(estimatedUnderstanding * 100)}%)، والإجراء الموصى به تالياً هو (${recommendedNextAction}).`,
    };
  }
}
