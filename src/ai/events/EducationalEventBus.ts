export type EducationalEventType =
  | "LessonCompleted"
  | "QuizPassed"
  | "QuizFailed"
  | "HomeworkSubmitted"
  | "HomeworkReviewed"
  | "StudyPlanCompleted"
  | "WeakTopicDetected"
  | "NewCourseUnlocked"
  | "ExamScheduled";

export interface EducationalEventPayload {
  studentId: string;
  courseId?: string;
  lessonId?: string;
  quizId?: string;
  score?: number;
  topic?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type EducationalEventHandler = (payload: EducationalEventPayload) => Promise<void> | void;

export class EducationalEventBus {
  private static instance: EducationalEventBus;
  private subscribers: Map<EducationalEventType, EducationalEventHandler[]> = new Map();

  public static getInstance(): EducationalEventBus {
    if (!EducationalEventBus.instance) {
      EducationalEventBus.instance = new EducationalEventBus();
    }
    return EducationalEventBus.instance;
  }

  public subscribe(eventType: EducationalEventType, handler: EducationalEventHandler): void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);
  }

  public async publish(eventType: EducationalEventType, payload: EducationalEventPayload): Promise<void> {
    const handlers = this.subscribers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error executing subscriber for '${eventType}':`, err);
      }
    }
  }
}
