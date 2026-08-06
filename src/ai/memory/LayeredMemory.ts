export interface StudentLongTermProfile {
  studentId: string;
  learningStyle: string;
  weakTopics: string[];
  strongTopics: string[];
  streakDays: number;
  overallProgress: number;
}

export class LayeredMemory {
  private static instance: LayeredMemory;

  // 1. Session Memory
  private sessionStore: Map<string, Array<{ role: string; content: string }>> = new Map();

  // 2. Short-Term Memory
  private shortTermStore: Map<string, Record<string, unknown>> = new Map();

  // 3. Long-Term Learning Profile
  private longTermProfiles: Map<string, StudentLongTermProfile> = new Map();

  // 4. Platform Facts
  private platformFacts: Map<string, string> = new Map();

  // 5. Temporary Workflow Context
  private workflowContexts: Map<string, Record<string, unknown>> = new Map();

  private constructor() {
    this.seedPlatformFacts();
  }

  public static getInstance(): LayeredMemory {
    if (!LayeredMemory.instance) {
      LayeredMemory.instance = new LayeredMemory();
    }
    return LayeredMemory.instance;
  }

  private seedPlatformFacts(): void {
    this.platformFacts.set("min_pass_score", "60%");
    this.platformFacts.set("system_name", "Code-UP Educational Platform");
    this.platformFacts.set("curriculum_country", "Egypt");
  }

  // Session Memory Accessors
  public addSessionTurn(sessionId: string, role: string, content: string): void {
    const history = this.sessionStore.get(sessionId) || [];
    history.push({ role, content });
    if (history.length > 20) history.shift();
    this.sessionStore.set(sessionId, history);
  }

  public getSessionHistory(sessionId: string): Array<{ role: string; content: string }> {
    return this.sessionStore.get(sessionId) || [];
  }

  // Long-Term Profile Accessors
  public getLongTermProfile(studentId: string): StudentLongTermProfile {
    return (
      this.longTermProfiles.get(studentId) || {
        studentId,
        learningStyle: "balanced",
        weakTopics: [],
        strongTopics: [],
        streakDays: 0,
        overallProgress: 0,
      }
    );
  }

  public updateLongTermProfile(studentId: string, updates: Partial<StudentLongTermProfile>): void {
    const current = this.getLongTermProfile(studentId);
    this.longTermProfiles.set(studentId, { ...current, ...updates });
  }

  // Platform Facts Accessors
  public getPlatformFact(key: string): string | undefined {
    return this.platformFacts.get(key);
  }

  // Temporary Workflow Context
  public setWorkflowContext(workflowId: string, context: Record<string, unknown>): void {
    this.workflowContexts.set(workflowId, context);
  }

  public getWorkflowContext(workflowId: string): Record<string, unknown> | undefined {
    return this.workflowContexts.get(workflowId);
  }

  public clearWorkflowContext(workflowId: string): void {
    this.workflowContexts.delete(workflowId);
  }
}
