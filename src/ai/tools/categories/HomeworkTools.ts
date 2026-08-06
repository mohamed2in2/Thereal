import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";

export class GetHomeworkTool implements AITool {
  public name = "GetHomework";
  public description = "Retrieves active homework assignments, deadline, and instructions.";
  public category = "Homework";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "homeworkId", type: "string", description: "Homework ID", required: false }];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      success: true,
      data: {
        id: context.homeworkId || "hw_101",
        title: "تطبيقات المتغيرات والجمل الشرطية",
        dueDate: "2026-07-25",
        status: "pending",
        totalTasks: 3,
        instructions: "اكتب برنامجاً يفحص درجة الطالب ويطبع تقديره الأكاديمي.",
      },
      executionTimeMs: 6,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
