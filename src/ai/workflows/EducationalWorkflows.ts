import { WorkflowEngine, WorkflowResult } from "./WorkflowEngine";

export class EducationalWorkflows {
  public static async runStudyPlanGeneration(studentId: string): Promise<WorkflowResult> {
    return WorkflowEngine.executeWorkflow("StudyPlanGeneration", [
      {
        name: "LoadProgress",
        action: (ctx) => ({ progressPercentage: 65, completedLessons: 12 }),
      },
      {
        name: "AnalyzeWeaknesses",
        action: (ctx) => ({ weakTopics: ["Arrays", "Loops"] }),
      },
      {
        name: "LoadUpcomingExams",
        action: (ctx) => ({ daysUntilExam: 14 }),
      },
      {
        name: "EstimateTime",
        action: (ctx) => ({ dailyMinutesBudget: 45 }),
      },
      {
        name: "GeneratePlan",
        action: (ctx) => ({ planTitle: "خطة التحضير المكثفة للاختبار" }),
      },
      {
        name: "SavePlan",
        action: (ctx) => ({ planSaved: true, planId: "plan_generated_99" }),
      },
      {
        name: "NotifyStudent",
        action: (ctx) => ({ notificationSent: true }),
      },
    ], { studentId });
  }

  public static async runRemediation(studentId: string, quizId: string): Promise<WorkflowResult> {
    return WorkflowEngine.executeWorkflow("RemediationWorkflow", [
      {
        name: "IdentifyError",
        action: (ctx) => ({ errorType: "SyntaxException", concept: "Variables" }),
      },
      {
        name: "GenerateRevision",
        action: (ctx) => ({ revisionText: "مراجعة مبسطة لقواعد المتغيرات" }),
      },
      {
        name: "GenerateTwinPractice",
        action: (ctx) => ({ twinQuestion: "عرف متغير كود جديد" }),
      },
      {
        name: "UpdateStudyPlan",
        action: (ctx) => ({ studyPlanUpdated: true }),
      },
    ], { studentId, quizId });
  }
}
