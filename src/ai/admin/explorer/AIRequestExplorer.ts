export interface AIRequestRecord {
  id: string;
  timestamp: string;
  studentId?: string;
  teacherId?: string;
  role: "student" | "teacher" | "admin" | "system";
  providerId: string;
  model: string;
  action: string;
  subject?: string;
  grade?: string;
  course?: string;
  lesson?: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  knowledgeLoaded: boolean;
  toolsUsed: string[];
  promptVersion?: string;
  responseLength: number;
  fallbackUsed: boolean;
  retryCount: number;
  budgetPolicy?: string;
  safetyFlags: string[];
}

export interface RequestSearchQuery {
  studentId?: string;
  teacherId?: string;
  providerId?: string;
  action?: string;
  subject?: string;
  grade?: string;
  dateFrom?: string;
  dateTo?: string;
  minCostUsd?: number;
  maxCostUsd?: number;
  minTokens?: number;
  maxTokens?: number;
  minLatencyMs?: number;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  limit?: number;
}

export class AIRequestExplorer {
  private static instance: AIRequestExplorer;
  private records: AIRequestRecord[] = [];
  private readonly MAX_RECORDS = 10000;

  public static getInstance(): AIRequestExplorer {
    if (!AIRequestExplorer.instance) {
      AIRequestExplorer.instance = new AIRequestExplorer();
    }
    return AIRequestExplorer.instance;
  }

  public record(data: Omit<AIRequestRecord, "id" | "timestamp">): AIRequestRecord {
    const rec: AIRequestRecord = {
      ...data,
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.records.push(rec);
    if (this.records.length > this.MAX_RECORDS) this.records.shift();
    return rec;
  }

  public search(query: RequestSearchQuery): AIRequestRecord[] {
    let results = [...this.records];

    if (query.studentId) results = results.filter(r => r.studentId === query.studentId);
    if (query.teacherId) results = results.filter(r => r.teacherId === query.teacherId);
    if (query.providerId) results = results.filter(r => r.providerId === query.providerId);
    if (query.action) results = results.filter(r => r.action === query.action);
    if (query.subject) results = results.filter(r => r.subject === query.subject);
    if (query.grade) results = results.filter(r => r.grade === query.grade);
    if (query.dateFrom) results = results.filter(r => r.timestamp >= query.dateFrom!);
    if (query.dateTo) results = results.filter(r => r.timestamp <= query.dateTo!);
    if (query.minCostUsd !== undefined) results = results.filter(r => r.estimatedCostUsd >= query.minCostUsd!);
    if (query.maxCostUsd !== undefined) results = results.filter(r => r.estimatedCostUsd <= query.maxCostUsd!);
    if (query.minTokens !== undefined) results = results.filter(r => (r.promptTokens + r.completionTokens) >= query.minTokens!);
    if (query.minLatencyMs !== undefined) results = results.filter(r => r.latencyMs >= query.minLatencyMs!);
    if (query.cacheHit !== undefined) results = results.filter(r => r.cacheHit === query.cacheHit);
    if (query.fallbackUsed !== undefined) results = results.filter(r => r.fallbackUsed === query.fallbackUsed);

    return results.slice(-(query.limit ?? 100)).reverse();
  }

  public getTodaysStats(): { totalRequests: number; totalCostUsd: number; totalTokens: number; avgLatencyMs: number } {
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = this.records.filter(r => r.timestamp.startsWith(today));
    const totalTokens = todayRecords.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);
    const totalLatency = todayRecords.reduce((s, r) => s + r.latencyMs, 0);
    return {
      totalRequests: todayRecords.length,
      totalCostUsd: todayRecords.reduce((s, r) => s + r.estimatedCostUsd, 0),
      totalTokens,
      avgLatencyMs: todayRecords.length > 0 ? Math.round(totalLatency / todayRecords.length) : 0,
    };
  }
}
