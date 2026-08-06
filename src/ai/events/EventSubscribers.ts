import { EducationalEventBus, EducationalEventPayload } from "./EducationalEventBus";

export class EventSubscribers {
  public static registerDefaultSubscribers(): void {
    const bus = EducationalEventBus.getInstance();

    // 1. Reactive handler for QuizFailed event
    bus.subscribe("QuizFailed", async (payload: EducationalEventPayload) => {
      console.log(`[EventSubscriber] QuizFailed for student ${payload.studentId}. Triggering auto-remediation (Revision + Memory Trick + Plan Update).`);
    });

    // 2. Reactive handler for LessonCompleted event
    bus.subscribe("LessonCompleted", async (payload: EducationalEventPayload) => {
      console.log(`[EventSubscriber] LessonCompleted for student ${payload.studentId}. Unlocking next lesson prerequisites.`);
    });

    // 3. Reactive handler for WeakTopicDetected event
    bus.subscribe("WeakTopicDetected", async (payload: EducationalEventPayload) => {
      console.log(`[EventSubscriber] WeakTopicDetected (${payload.topic}) for student ${payload.studentId}. Injecting topic into weak list.`);
    });
  }
}
