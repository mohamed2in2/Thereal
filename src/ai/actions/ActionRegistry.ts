import { EducationalAction, EducationalActionType } from "../types";
import {
  ExplainAction,
  SimplifyAction,
  SolveAction,
  HintAction,
  QuizAction,
  HomeworkAction,
  ReviewAction,
  FlashcardsAction,
  SummaryAction,
  RevisionAction,
  CompareAction,
} from "./modules/learning-actions";
import {
  ExamAction,
  PlanAction,
  NextLessonAction,
  RecommendAction,
  MemoryTrickAction,
  MotivateAction,
  AnalyzeProgressAction,
  ParentReportAction,
  TeacherReportAction,
  SearchPlatformAction,
} from "./modules/planning-reporting-actions";

export class ActionRegistry {
  private static instance: ActionRegistry;
  private actions: Map<EducationalActionType, EducationalAction> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ActionRegistry {
    if (!ActionRegistry.instance) {
      ActionRegistry.instance = new ActionRegistry();
    }
    return ActionRegistry.instance;
  }

  private registerDefaults(): void {
    const defaultActions: EducationalAction[] = [
      new ExplainAction(),
      new SimplifyAction(),
      new SolveAction(),
      new HintAction(),
      new QuizAction(),
      new HomeworkAction(),
      new ReviewAction(),
      new FlashcardsAction(),
      new SummaryAction(),
      new RevisionAction(),
      new CompareAction(),
      new ExamAction(),
      new PlanAction(),
      new NextLessonAction(),
      new RecommendAction(),
      new MemoryTrickAction(),
      new MotivateAction(),
      new AnalyzeProgressAction(),
      new ParentReportAction(),
      new TeacherReportAction(),
      new SearchPlatformAction(),
    ];

    for (const action of defaultActions) {
      this.registerAction(action);
    }
  }

  public registerAction(action: EducationalAction): void {
    this.actions.set(action.type, action);
  }

  public getAction(type: EducationalActionType): EducationalAction {
    const action = this.actions.get(type);
    if (!action) {
      console.warn(`[ActionRegistry] Unknown action type '${type}'. Defaulting to EXPLAIN action.`);
      return this.actions.get("EXPLAIN") || new ExplainAction();
    }
    return action;
  }

  public hasAction(type: EducationalActionType): boolean {
    return this.actions.has(type);
  }

  public getAllActions(): EducationalAction[] {
    return Array.from(this.actions.values());
  }

  public getSupportedTypes(): EducationalActionType[] {
    return Array.from(this.actions.keys());
  }
}
