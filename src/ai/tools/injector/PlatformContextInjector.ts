import { AIContext } from "../../types";
import { ToolChainer } from "../chainer/ToolChainer";
import { ToolExecutionContext } from "../types";

export interface ActivePlatformState {
  currentPage?: string;
  currentScreen?: string;
  currentTab?: string;
  currentLessonId?: string;
  currentVideoId?: string;
  currentQuizId?: string;
  currentHomeworkId?: string;
  currentCourseId?: string;
}

export class PlatformContextInjector {
  private chainer: ToolChainer;

  constructor(chainer?: ToolChainer) {
    this.chainer = chainer || new ToolChainer();
  }

  public async autoInjectContext(
    userId: string,
    activeState: ActivePlatformState = {},
    baseContext: AIContext
  ): Promise<AIContext> {
    const execContext: ToolExecutionContext = {
      userId,
      userRole: "student",
      courseId: activeState.currentCourseId,
      lessonId: activeState.currentLessonId,
      quizId: activeState.currentQuizId,
      homeworkId: activeState.currentHomeworkId,
    };

    // Execute tool chain asynchronously to assemble platform state
    const toolResults = await this.chainer.executeChain(execContext, [
      { toolName: "GetStudentProfile" },
      { toolName: "GetCurrentCourse" },
      { toolName: "GetLesson" },
      { toolName: "TodayPlan" },
    ]);

    const profileData = toolResults[0]?.success ? (toolResults[0].data as any) : null;
    const courseData = toolResults[1]?.success ? (toolResults[1].data as any) : null;
    const lessonData = toolResults[2]?.success ? (toolResults[2].data as any) : null;
    const planData = toolResults[3]?.success ? (toolResults[3].data as any) : null;

    return {
      ...baseContext,
      student: {
        id: userId,
        name: profileData?.name || baseContext.student.name,
      },
      course: {
        id: courseData?.id || baseContext.course.id,
        title: courseData?.title || baseContext.course.title,
        subject: courseData?.subject || baseContext.course.subject,
      },
      lesson: {
        id: lessonData?.id || baseContext.lesson.id,
        title: lessonData?.title || baseContext.lesson.title,
        order: lessonData?.order || baseContext.lesson.order,
      },
      lessonProgress: {
        watched: !!courseData,
        completionPercentage: courseData?.progressPercentage || 0,
      },
      weakChapters: courseData ? (profileData?.weakSubjects || []) : [],
      strongChapters: courseData ? (profileData?.strongSubjects || []) : [],
      studyPlan: {
        id: profileData?.currentPlanId || baseContext.studyPlan.id,
        targetGoals: profileData?.goals || baseContext.studyPlan.targetGoals,
      },
    };
  }
}
