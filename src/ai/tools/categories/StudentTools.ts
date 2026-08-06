import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";
import { buildStudentContext } from "@/lib/ai-context";

export class StudentProfileTool implements AITool {
  public name = "GetStudentProfile";
  public description = "Retrieves student name, grade, track, language preference, learning style, goals, weak/strong subjects, streak, available time, current courses, and plan.";
  public category = "Student";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = true;
  public ttlMs = 300000;

  public parameters(): ToolParameterSchema[] {
    return [
      { name: "studentId", type: "string", description: "ID of the student", required: false },
    ];
  }

  public validate(params?: Record<string, unknown>): boolean {
    return true;
  }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      if (context.userId && context.userId !== "anon" && context.userId !== "std_demo_001") {
        const studentCtx = await buildStudentContext(context.userId);
        return {
          success: true,
          data: {
            id: studentCtx.profile.id,
            name: studentCtx.profile.name,
            grade: studentCtx.profile.educationalStage || "غير محدد",
            educationalTrack: "عام",
            preferredLanguage: "ar",
            learningStyle: "balanced",
            goals: studentCtx.courses.map((c) => `إتقان مادة ${c.subject}`),
            weakSubjects: studentCtx.weakAreas.map((w) => `${w.subject}: ${w.topic}`),
            strongSubjects: [],
            studyStreakDays: 0,
            availableTimeMinutes: 45,
            currentCourses: studentCtx.courses.map((c) => c.title),
            currentPlanId: null,
          },
          executionTimeMs: Date.now() - startTime,
        };
      }
    } catch {
      /* fallback if user not found */
    }

    return {
      success: true,
      data: {
        id: context.userId,
        name: "طالب",
        grade: "عام",
        educationalTrack: "عام",
        preferredLanguage: "ar",
        learningStyle: "balanced",
        goals: [],
        weakSubjects: [],
        strongSubjects: [],
        studyStreakDays: 0,
        availableTimeMinutes: 30,
        currentCourses: [],
        currentPlanId: null,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  public async health(): Promise<boolean> {
    return true;
  }
}
