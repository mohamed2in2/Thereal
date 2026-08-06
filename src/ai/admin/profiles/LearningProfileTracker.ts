export interface DetailedLearningProfile {
  studentId: string;
  learningSpeed: "slow" | "normal" | "fast";
  revisionFrequencyDays: number;
  quizAccuracyPercentage: number;
  homeworkCompletionPercentage: number;
  studyStreakDays: number;
  estimatedBurnoutRisk: "Low" | "Medium" | "High";
  examReadinessPercentage: number;
}

export class LearningProfileTracker {
  public static calculateMetrics(
    studentId: string,
    quizAccuracy = 82,
    studyHoursWeekly = 10,
    streak = 7
  ): DetailedLearningProfile {
    let burnoutRisk: "Low" | "Medium" | "High" = "Low";
    if (studyHoursWeekly > 25) burnoutRisk = "High";
    else if (studyHoursWeekly > 15) burnoutRisk = "Medium";

    const examReadinessPercentage = Math.min(100, Math.round(quizAccuracy * 0.7 + streak * 2));

    return {
      studentId,
      learningSpeed: quizAccuracy > 85 ? "fast" : quizAccuracy > 65 ? "normal" : "slow",
      revisionFrequencyDays: 3,
      quizAccuracyPercentage: quizAccuracy,
      homeworkCompletionPercentage: 90,
      studyStreakDays: streak,
      estimatedBurnoutRisk: burnoutRisk,
      examReadinessPercentage,
    };
  }
}
