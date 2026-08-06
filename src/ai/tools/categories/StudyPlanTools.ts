import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";
import { buildStudentContext } from "@/lib/ai-context";

export class TodayPlanTool implements AITool {
  public name = "TodayPlan";
  public description = "Retrieves today's study plan items, target duration, and completed tasks.";
  public category = "StudyPlan";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] { return []; }
  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      if (context.userId && context.userId !== "anon" && context.userId !== "std_demo_001") {
        const studentCtx = await buildStudentContext(context.userId);
        if (studentCtx.courses.length > 0) {
          const items = studentCtx.courses.slice(0, 2).map((c) => ({
            task: `مذاكرة درس من مادة ${c.subject} (${c.title})`,
            durationMinutes: 20,
            completed: c.progress.percentage > 0,
          }));
          return {
            success: true,
            data: {
              planDate: new Date().toISOString().split("T")[0],
              items,
              totalMinutes: items.length * 20,
            },
            executionTimeMs: Date.now() - startTime,
          };
        }
      }
    } catch {
      /* fallback */
    }

    return {
      success: true,
      data: {
        planDate: new Date().toISOString().split("T")[0],
        items: [],
        totalMinutes: 0,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
