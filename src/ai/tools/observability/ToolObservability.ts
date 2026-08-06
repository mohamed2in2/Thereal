export interface ToolLogEvent {
  toolName: string;
  userId: string;
  userRole: string;
  executionTimeMs: number;
  success: boolean;
  cacheHit: boolean;
  error?: string;
  timestamp: Date;
}

export class ToolObservability {
  private static instance: ToolObservability;
  private logs: ToolLogEvent[] = [];

  public static getInstance(): ToolObservability {
    if (!ToolObservability.instance) {
      ToolObservability.instance = new ToolObservability();
    }
    return ToolObservability.instance;
  }

  public logExecution(event: Omit<ToolLogEvent, "timestamp">): void {
    this.logs.push({ ...event, timestamp: new Date() });
    if (this.logs.length > 500) this.logs.shift();
  }

  public getLogs(): ToolLogEvent[] {
    return [...this.logs];
  }
}
