import { AIContext, EducationalActionType } from "../types";

export interface ContextOptions {
  studentId?: string;
  subject?: string;
  grade?: string;
  action?: EducationalActionType;
  overrides?: Partial<AIContext>;
}

export class ContextBuilder {
  /**
   * Builds the complete AIContext object combining platform metadata and defaults.
   */
  public buildContext(options: ContextOptions = {}): AIContext {
    const defaultContext: AIContext = {
      student: {
        id: options.studentId || "std_demo_001",
        name: "طالب Code-UP",
        email: "student@code-up.edu",
      },
      currentGrade: options.grade || "prep_3",
      educationalTrack: "General STEM & Programming",
      language: "ar",
      course: {
        id: "",
        title: options.subject ? `${options.subject}` : "عام (غير مسجل بكورس)",
        subject: options.subject || "عام",
      },
      lesson: {
        id: "",
        title: "عام",
        order: 0,
      },
      lessonProgress: {
        watched: false,
        completionPercentage: 0,
      },
      currentQuiz: {},
      quizHistory: [],
      homeworkStatus: {
        pendingCount: 0,
        completedCount: 0,
      },
      studyPlan: {
        id: "",
        targetGoals: [],
        currentModule: "",
      },
      weakChapters: [],
      strongChapters: [],
      availableTime: 45, // minutes
      learningPreference: "balanced",
      platformSettings: {
        theme: "dark",
        maxTokenBudget: 4000,
        strictMode: true,
      },
      currentDate: new Date().toISOString().split("T")[0],
      currentAction: options.action || "EXPLAIN",
    };

    // Apply any explicit overrides
    if (options.overrides) {
      return {
        ...defaultContext,
        ...options.overrides,
        student: { ...defaultContext.student, ...(options.overrides.student || {}) },
        course: { ...defaultContext.course, ...(options.overrides.course || {}) },
        lesson: { ...defaultContext.lesson, ...(options.overrides.lesson || {}) },
        lessonProgress: { ...defaultContext.lessonProgress, ...(options.overrides.lessonProgress || {}) },
        currentQuiz: { ...defaultContext.currentQuiz, ...(options.overrides.currentQuiz || {}) },
        homeworkStatus: { ...defaultContext.homeworkStatus, ...(options.overrides.homeworkStatus || {}) },
        studyPlan: { ...defaultContext.studyPlan, ...(options.overrides.studyPlan || {}) },
        platformSettings: { ...defaultContext.platformSettings, ...(options.overrides.platformSettings || {}) },
      };
    }

    return defaultContext;
  }

  /**
   * Returns a minimal fallback context if context retrieval fails or is empty.
   */
  public getMinimalContext(action: EducationalActionType = "EXPLAIN"): AIContext {
    return {
      student: { id: "anon", name: "طالب" },
      currentGrade: "General",
      educationalTrack: "General",
      language: "ar",
      course: { id: "unknown", title: "مادة عامة", subject: "عام" },
      lesson: { id: "unknown", title: "درس عام" },
      lessonProgress: { watched: false, completionPercentage: 0 },
      currentQuiz: {},
      quizHistory: [],
      homeworkStatus: { pendingCount: 0, completedCount: 0 },
      studyPlan: {},
      weakChapters: [],
      strongChapters: [],
      availableTime: 30,
      learningPreference: "balanced",
      platformSettings: {},
      currentDate: new Date().toISOString().split("T")[0],
      currentAction: action,
    };
  }

  /**
   * Compresses context object if prompt size exceeds budget.
   */
  public compressContext(context: AIContext): AIContext {
    return {
      ...context,
      quizHistory: context.quizHistory.slice(0, 1), // keep only latest
      weakChapters: context.weakChapters.slice(0, 2),
      strongChapters: context.strongChapters.slice(0, 2),
      studyPlan: { id: context.studyPlan.id },
    };
  }
}
