export interface DetailedInteractionLog {
  id: string;
  timestamp: Date;
  studentId: string;
  provider: string;
  action: string;
  subject: string;
  grade: string;
  toolsUsed: string[];
  tokens: number;
  latencyMs: number;
  success: boolean;
  safetyFlags?: string[];
  promptVersion?: number;
}

export class AILogger {
  private static instance: AILogger;
  private logs: DetailedInteractionLog[] = [];

  public static getInstance(): AILogger {
    if (!AILogger.instance) {
      AILogger.instance = new AILogger();
    }
    return AILogger.instance;
  }

  public logInteraction(log: Omit<DetailedInteractionLog, "id" | "timestamp">): DetailedInteractionLog {
    const fullLog: DetailedInteractionLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    };

    this.logs.push(fullLog);
    if (this.logs.length > 2000) this.logs.shift();

    return fullLog;
  }

  public searchLogs(query: { subject?: string; action?: string; studentId?: string }, limit = 50): DetailedInteractionLog[] {
    return this.logs
      .filter((l) => {
        if (query.subject && l.subject.toLowerCase() !== query.subject.toLowerCase()) return false;
        if (query.action && l.action !== query.action) return false;
        if (query.studentId && l.studentId !== query.studentId) return false;
        return true;
      })
      .slice(-limit);
  }
}
