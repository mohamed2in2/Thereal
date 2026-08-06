export interface MemoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  action?: string;
}

export class MemoryManager {
  private static instance: MemoryManager;
  private sessionStore: Map<string, MemoryMessage[]> = new Map();
  private maxHistoryPerSession = 15;

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  public addMessage(sessionId: string, message: Omit<MemoryMessage, "timestamp">): void {
    const history = this.sessionStore.get(sessionId) || [];
    history.push({ ...message, timestamp: new Date() });

    if (history.length > this.maxHistoryPerSession) {
      history.shift();
    }

    this.sessionStore.set(sessionId, history);
  }

  public getHistory(sessionId: string): MemoryMessage[] {
    return this.sessionStore.get(sessionId) || [];
  }

  public getFormattedHistory(sessionId: string, limit = 5): string {
    const history = this.getHistory(sessionId).slice(-limit);
    if (history.length === 0) return "";

    return history
      .map((msg) => `${msg.role === "user" ? "الطالب" : "المساعد"}: ${msg.content}`)
      .join("\n");
  }

  public clearSession(sessionId: string): void {
    this.sessionStore.delete(sessionId);
  }
}
