export type ScheduledTaskType =
  | "DailyStudyPlan"
  | "WeeklyReport"
  | "MonthlyAnalytics"
  | "HealthCheck"
  | "MemoryCleanup";

export interface ScheduledTaskExecution {
  taskName: ScheduledTaskType;
  executedAt: Date;
  success: boolean;
  message: string;
}

export class AIScheduler {
  private static instance: AIScheduler;
  private history: ScheduledTaskExecution[] = [];

  public static getInstance(): AIScheduler {
    if (!AIScheduler.instance) {
      AIScheduler.instance = new AIScheduler();
    }
    return AIScheduler.instance;
  }

  public async triggerScheduledTask(taskName: ScheduledTaskType): Promise<ScheduledTaskExecution> {
    const execution: ScheduledTaskExecution = {
      taskName,
      executedAt: new Date(),
      success: true,
      message: `Task [${taskName}] executed successfully.`,
    };

    this.history.push(execution);
    return execution;
  }

  public getHistory(): ScheduledTaskExecution[] {
    return [...this.history];
  }
}
