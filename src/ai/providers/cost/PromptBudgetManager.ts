import { EducationalActionType } from "../../types";

export class PromptBudgetManager {
  private static actionBudgets: Record<string, number> = {
    EXPLAIN: 1800,
    SIMPLIFY: 1000,
    SOLVE: 2500,
    HINT: 1200,
    QUIZ: 1500,
    HOMEWORK: 1200,
    REVIEW: 1500,
    FLASHCARDS: 1000,
    SUMMARY: 1200,
    REVISION: 1500,
    COMPARE: 1500,
    EXAM: 3500,
    PLAN: 2200,
    NEXT_LESSON: 800,
    RECOMMEND: 1000,
    MEMORY_TRICK: 800,
    MOTIVATE: 500,
    ANALYZE_PROGRESS: 1500,
    PARENT_REPORT: 1800,
    TEACHER_REPORT: 2500,
    SEARCH_PLATFORM: 800,
    GREETING: 300,
  };

  public static getBudgetForAction(action: EducationalActionType | string): number {
    return this.actionBudgets[action] || 1800;
  }

  public static setBudgetForAction(action: string, budget: number): void {
    this.actionBudgets[action] = budget;
  }

  public static isWithinBudget(action: EducationalActionType | string, estimatedTokens: number): {
    withinBudget: boolean;
    allowedBudget: number;
    estimatedTokens: number;
  } {
    const allowedBudget = this.getBudgetForAction(action);
    return {
      withinBudget: estimatedTokens <= allowedBudget,
      allowedBudget,
      estimatedTokens,
    };
  }
}
