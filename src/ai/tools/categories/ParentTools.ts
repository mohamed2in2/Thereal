import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";
import { buildStudentContext } from "@/lib/ai-context";

export class GenerateParentReportTool implements AITool {
  public name = "GenerateParentReport";
  public description = "Generates comprehensive progress reports, study duration, strengths, and weaknesses for parents.";
  public category = "Parent";
  public allowedRoles: UserRole[] = ["teacher", "superadmin"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "studentId", type: "string", description: "Student ID", required: true }];
  }

  public validate(params?: Record<string, unknown>): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      if (context.userId && context.userId !== "anon") {
        const studentCtx = await buildStudentContext(context.userId);
        return {
          success: true,
          data: {
            studentName: studentCtx.profile.name,
            weeklyStudyHours: studentCtx.overallStats.totalVideosWatched * 0.2,
            quizPassRatePercentage: studentCtx.overallStats.averageScore,
            strengths: studentCtx.overallStats.averageScore >= 75 ? ["أداء عام ممتاز"] : [],
            weaknesses: studentCtx.weakAreas.map((w) => `${w.subject}: ${w.topic}`),
            parentRecommendations: ["متابعة حل الكويزات بانتظام على المنصة"],
          },
          executionTimeMs: Date.now() - startTime,
        };
      }
    } catch {
      /* fallback */
    }

    return {
      success: true,
      data: {
        studentName: "طالب",
        weeklyStudyHours: 0,
        quizPassRatePercentage: 0,
        strengths: [],
        weaknesses: [],
        parentRecommendations: [],
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
