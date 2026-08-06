export interface WorkflowStep {
  name: string;
  action: (context: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface WorkflowResult {
  workflowName: string;
  success: boolean;
  finalContext: Record<string, unknown>;
  executedSteps: string[];
  durationMs: number;
}

export class WorkflowEngine {
  public static async executeWorkflow(
    workflowName: string,
    steps: WorkflowStep[],
    initialContext: Record<string, unknown> = {}
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    let currentContext = { ...initialContext };
    const executedSteps: string[] = [];

    for (const step of steps) {
      try {
        const stepOutput = await step.action(currentContext);
        currentContext = { ...currentContext, ...stepOutput };
        executedSteps.push(step.name);
      } catch (err: unknown) {
        console.error(`[WorkflowEngine] Step '${step.name}' failed in workflow '${workflowName}':`, err);
        return {
          workflowName,
          success: false,
          finalContext: currentContext,
          executedSteps,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      workflowName,
      success: true,
      finalContext: currentContext,
      executedSteps,
      durationMs: Date.now() - startTime,
    };
  }
}
