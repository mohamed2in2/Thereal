export type StudentEducationalState =
  | "NEW_STUDENT"
  | "ONBOARDING"
  | "EXPLORING"
  | "WATCHING_LESSON"
  | "READING"
  | "PRACTICING"
  | "DOING_HOMEWORK"
  | "TAKING_QUIZ"
  | "FAILED_ONCE"
  | "FAILED_MULTIPLE"
  | "REVISION_REQUIRED"
  | "MASTERING_TOPIC"
  | "READY_FOR_NEXT"
  | "INACTIVE"
  | "EXAM_PREPARATION"
  | "FINISHED";

export type EducationalStateTrigger =
  | "START_LESSON"
  | "FINISH_LESSON"
  | "START_QUIZ"
  | "PASS_QUIZ"
  | "FAIL_QUIZ"
  | "SUBMIT_HOMEWORK"
  | "FAIL_HOMEWORK"
  | "REQUEST_REVISION"
  | "SCHEDULE_EXAM"
  | "COMPLETE_COURSE";

export class StudentStateMachine {
  private currentState: StudentEducationalState;

  constructor(initialState: StudentEducationalState = "EXPLORING") {
    this.currentState = initialState;
  }

  public getState(): StudentEducationalState {
    return this.currentState;
  }

  public transition(trigger: EducationalStateTrigger): StudentEducationalState {
    switch (this.currentState) {
      case "EXPLORING":
      case "NEW_STUDENT":
      case "ONBOARDING":
        if (trigger === "START_LESSON") this.currentState = "WATCHING_LESSON";
        if (trigger === "SCHEDULE_EXAM") this.currentState = "EXAM_PREPARATION";
        break;

      case "WATCHING_LESSON":
      case "READING":
        if (trigger === "FINISH_LESSON") this.currentState = "TAKING_QUIZ";
        if (trigger === "SUBMIT_HOMEWORK") this.currentState = "DOING_HOMEWORK";
        break;

      case "TAKING_QUIZ":
        if (trigger === "PASS_QUIZ") this.currentState = "READY_FOR_NEXT";
        if (trigger === "FAIL_QUIZ") this.currentState = "FAILED_ONCE";
        break;

      case "FAILED_ONCE":
        if (trigger === "FAIL_QUIZ") this.currentState = "FAILED_MULTIPLE";
        if (trigger === "PASS_QUIZ") this.currentState = "MASTERING_TOPIC";
        if (trigger === "REQUEST_REVISION") this.currentState = "REVISION_REQUIRED";
        break;

      case "FAILED_MULTIPLE":
        if (trigger === "REQUEST_REVISION" || trigger === "START_LESSON") this.currentState = "REVISION_REQUIRED";
        if (trigger === "PASS_QUIZ") this.currentState = "MASTERING_TOPIC";
        break;

      case "REVISION_REQUIRED":
        if (trigger === "FINISH_LESSON") this.currentState = "PRACTICING";
        break;

      case "PRACTICING":
        if (trigger === "PASS_QUIZ") this.currentState = "READY_FOR_NEXT";
        break;

      case "READY_FOR_NEXT":
      case "MASTERING_TOPIC":
        if (trigger === "START_LESSON") this.currentState = "WATCHING_LESSON";
        if (trigger === "COMPLETE_COURSE") this.currentState = "FINISHED";
        break;

      default:
        break;
    }

    return this.currentState;
  }
}
