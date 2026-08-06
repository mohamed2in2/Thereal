import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";

export class SearchPlatformTool implements AITool {
  public name = "SearchPlatform";
  public description = "Searches Code-UP courses, lessons, quizzes, and study material.";
  public category = "Platform";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin", "anonymous"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "query", type: "string", description: "Search term", required: true }];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<ToolExecutionResult> {
    const query = (params?.query as string) || "";
    return {
      success: true,
      data: {
        query,
        matchedLessons: [],
        matchedQuizzes: [],
      },
      executionTimeMs: 5,
    };
  }

  public async health(): Promise<boolean> { return true; }
}

export class StreakTool implements AITool {
  public name = "Streak";
  public description = "Returns student's active study streak and streak badges.";
  public category = "Platform";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] { return []; }
  public validate(): boolean { return true; }

  public async execute(): Promise<ToolExecutionResult> {
    return {
      success: true,
      data: { currentStreakDays: 7, maxStreakDays: 14, badge: "Fire Streak 🔥" },
      executionTimeMs: 2,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
