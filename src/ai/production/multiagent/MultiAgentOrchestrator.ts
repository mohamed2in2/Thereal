export type AgentRole =
  | "TeacherAgent"
  | "StudentAgent"
  | "PlannerAgent"
  | "RetrieverAgent"
  | "ReasoningAgent"
  | "EvaluationAgent";

export interface AgentTask {
  agentRole: AgentRole;
  prompt: string;
}

export interface AgentExecutionResult {
  agentRole: AgentRole;
  output: string;
  executionTimeMs: number;
}

export class MultiAgentOrchestrator {
  public static async executeTaskGraph(tasks: AgentTask[]): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];

    for (const task of tasks) {
      const startTime = Date.now();
      results.push({
        agentRole: task.agentRole,
        output: `[Output from ${task.agentRole} for prompt: '${task.prompt}']`,
        executionTimeMs: Date.now() - startTime,
      });
    }

    return results;
  }
}
