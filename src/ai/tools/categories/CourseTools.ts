import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";
import { buildStudentContext } from "@/lib/ai-context";

export class GetCurrentCourseTool implements AITool {
  public name = "GetCurrentCourse";
  public description = "Gets current active course details, subject, and progress.";
  public category = "Course";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin", "anonymous"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "courseId", type: "string", description: "Course ID", required: false }];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      if (context.userId && context.userId !== "anon" && context.userId !== "std_demo_001") {
        const studentCtx = await buildStudentContext(context.userId);
        if (studentCtx.courses.length > 0) {
          const activeCourse = studentCtx.courses[0];
          return {
            success: true,
            data: {
              id: activeCourse.id,
              title: activeCourse.title,
              subject: activeCourse.subject,
              teacherName: activeCourse.teacher,
              progressPercentage: activeCourse.progress.percentage,
              totalLessons: activeCourse.progress.totalVideos,
              completedLessonsCount: activeCourse.progress.videosWatched,
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
        id: "",
        title: "غير مسجل في أي كورس حالياً",
        subject: "عام",
        teacherName: "غير محدد",
        progressPercentage: 0,
        totalLessons: 0,
        completedLessonsCount: 0,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  public async health(): Promise<boolean> { return true; }
}

export class GetLessonTool implements AITool {
  public name = "GetLesson";
  public description = "Retrieves lesson details, objectives, and resources.";
  public category = "Course";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin", "anonymous"];
  public cacheable = true;

  public parameters(): ToolParameterSchema[] {
    return [{ name: "lessonId", type: "string", description: "Lesson ID", required: false }];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      if (context.userId && context.userId !== "anon" && context.userId !== "std_demo_001") {
        const studentCtx = await buildStudentContext(context.userId);
        if (studentCtx.courses.length > 0) {
          const firstCourse = studentCtx.courses[0];
          return {
            success: true,
            data: {
              id: firstCourse.id,
              title: firstCourse.title,
              order: 1,
              objectives: [`مذاكرة ومراجعة ${firstCourse.title}`],
              resources: [],
              estimatedStudyMinutes: 30,
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
        id: "",
        title: "غير مسجل في أي درس حالياً",
        order: 0,
        objectives: [],
        resources: [],
        estimatedStudyMinutes: 0,
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
