import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";

export class TeacherAnalyticsTool implements AITool {
  public name = "TeacherAnalytics";
  public description = "Retrieves class performance analytics, weak topics, and common student mistakes for teachers.";
  public category = "Teacher";
  public allowedRoles: UserRole[] = ["teacher", "superadmin"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "classId", type: "string", description: "Class ID", required: false }];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      success: true,
      data: {
        totalStudents: 45,
        activeStudents: 42,
        averageQuizScore: 78,
        commonMistakes: ["خلط المفاهيم بين let و const", "أخطاء في كتابة الشروط المزدوجة"],
        weakestTopic: "الدوال والوحدات المتقدمة",
      },
      executionTimeMs: 12,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
