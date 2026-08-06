import { EducationalActionType } from "../types";

export type ModelTier = "fast" | "strong" | "embedding" | "multimodal";

export interface ModelSelection {
  tier: ModelTier;
  recommendedModel: string;
  reasoning: string;
}

export class TaskModelRouter {
  private fastActions: Set<EducationalActionType> = new Set([
    "HINT",
    "SUMMARY",
    "MOTIVATE",
    "FLASHCARDS",
    "SEARCH_PLATFORM",
    "RECOMMEND",
    "MEMORY_TRICK",
  ]);

  private strongActions: Set<EducationalActionType> = new Set([
    "SOLVE",
    "EXAM",
    "QUIZ",
    "ANALYZE_PROGRESS",
    "TEACHER_REPORT",
    "PARENT_REPORT",
    "PLAN",
    "HOMEWORK",
  ]);

  public routeTask(action: EducationalActionType): ModelSelection {
    if (this.strongActions.has(action)) {
      return {
        tier: "strong",
        recommendedModel: process.env.STRONG_MODEL_ID || "deepseek-reasoner / gpt-4o",
        reasoning: `Action '${action}' requires deep reasoning and high accuracy (Strong Model Tier).`,
      };
    }

    if (this.fastActions.has(action)) {
      return {
        tier: "fast",
        recommendedModel: process.env.FAST_MODEL_ID || "deepseek-chat / gpt-4o-mini / gemini-flash",
        reasoning: `Action '${action}' favors low latency and quick response (Fast Model Tier).`,
      };
    }

    return {
      tier: "fast",
      recommendedModel: process.env.DEFAULT_MODEL_ID || "mock-v1",
      reasoning: `Standard educational action '${action}' routed to default tier.`,
    };
  }
}
