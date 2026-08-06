import { AIRequestExplorer } from "../explorer/AIRequestExplorer";
import { ProviderMonitor } from "../monitoring/ProviderMonitor";

// ─── Student AI Analytics ───────────────────────────────────────────────────

export interface StudentAIProfile {
  studentId: string;
  questionsAsked: number;
  avgSessionTokens: number;
  avgCostUsd: number;
  totalCostUsd: number;
  mostUsedAction: string;
  favoriteSubject: string;
  weakSubjects: string[];
  strongSubjects: string[];
  studyStreak: number;
  lastAIUsage: string;
  aiDependencyScore: number; // 0–100
}

export class StudentAIAnalytics {
  private static instance: StudentAIAnalytics;
  public static getInstance(): StudentAIAnalytics {
    if (!StudentAIAnalytics.instance) StudentAIAnalytics.instance = new StudentAIAnalytics();
    return StudentAIAnalytics.instance;
  }

  public getProfile(studentId: string): StudentAIProfile {
    const explorer = AIRequestExplorer.getInstance();
    const requests = explorer.search({ studentId, limit: 200 });
    const totalCostUsd = requests.reduce((s, r) => s + r.estimatedCostUsd, 0);
    const totalTokens = requests.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);

    const actionCounts: Record<string, number> = {};
    const subjectCounts: Record<string, number> = {};
    for (const r of requests) {
      if (r.action) actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
      if (r.subject) subjectCounts[r.subject] = (subjectCounts[r.subject] || 0) + 1;
    }

    const mostUsedAction = Object.entries(actionCounts).sort(([,a],[,b]) => b - a)[0]?.[0] || "EXPLAIN";
    const favoriteSubject = Object.entries(subjectCounts).sort(([,a],[,b]) => b - a)[0]?.[0] || "General";
    const lastRequest = requests[0];
    const aiDependencyScore = Math.min(100, Math.round((requests.length / 10) * 15));

    return {
      studentId,
      questionsAsked: requests.length,
      avgSessionTokens: requests.length > 0 ? Math.round(totalTokens / requests.length) : 0,
      avgCostUsd: requests.length > 0 ? totalCostUsd / requests.length : 0,
      totalCostUsd,
      mostUsedAction,
      favoriteSubject,
      weakSubjects: [],
      strongSubjects: [favoriteSubject],
      studyStreak: 0,
      lastAIUsage: lastRequest?.timestamp || "N/A",
      aiDependencyScore,
    };
  }
}

// ─── Teacher Analytics ──────────────────────────────────────────────────────

export interface TeacherAnalyticsProfile {
  teacherId: string;
  studentsHelped: number;
  reportsGenerated: number;
  totalCostUsd: number;
  avgCostUsd: number;
  totalTokensUsed: number;
  mostUsedFeatures: string[];
  mostDifficultSubjects: string[];
}

export class TeacherAnalytics {
  private static instance: TeacherAnalytics;
  public static getInstance(): TeacherAnalytics {
    if (!TeacherAnalytics.instance) TeacherAnalytics.instance = new TeacherAnalytics();
    return TeacherAnalytics.instance;
  }

  public getProfile(teacherId: string): TeacherAnalyticsProfile {
    const explorer = AIRequestExplorer.getInstance();
    const requests = explorer.search({ teacherId, limit: 200 });
    const totalCostUsd = requests.reduce((s, r) => s + r.estimatedCostUsd, 0);
    const totalTokens = requests.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);
    const reports = requests.filter(r => r.action === "TEACHER_REPORT" || r.action === "PARENT_REPORT");
    const actionCounts: Record<string, number> = {};
    for (const r of requests) actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
    const topFeatures = Object.entries(actionCounts).sort(([,a],[,b]) => b - a).slice(0, 5).map(([k]) => k);

    return {
      teacherId,
      studentsHelped: new Set(requests.map(r => r.studentId).filter(Boolean)).size,
      reportsGenerated: reports.length,
      totalCostUsd,
      avgCostUsd: requests.length > 0 ? totalCostUsd / requests.length : 0,
      totalTokensUsed: totalTokens,
      mostUsedFeatures: topFeatures,
      mostDifficultSubjects: [],
    };
  }
}

// ─── Parent Analytics ───────────────────────────────────────────────────────

export interface ParentAnalyticsProfile {
  parentId: string;
  reportsGenerated: number;
  notificationsSent: number;
  readRate: number;   // 0–100%
  weeklyReports: number;
  monthlyReports: number;
  avgStudentImprovement: number;
}

export class ParentAnalytics {
  private static instance: ParentAnalytics;
  private reportLog: Map<string, { generated: number; read: number }> = new Map();
  public static getInstance(): ParentAnalytics {
    if (!ParentAnalytics.instance) ParentAnalytics.instance = new ParentAnalytics();
    return ParentAnalytics.instance;
  }

  public recordReportGenerated(parentId: string): void {
    const entry = this.reportLog.get(parentId) || { generated: 0, read: 0 };
    entry.generated++;
    this.reportLog.set(parentId, entry);
  }

  public recordReportRead(parentId: string): void {
    const entry = this.reportLog.get(parentId) || { generated: 0, read: 0 };
    entry.read++;
    this.reportLog.set(parentId, entry);
  }

  public getProfile(parentId: string): ParentAnalyticsProfile {
    const entry = this.reportLog.get(parentId) || { generated: 0, read: 0 };
    const readRate = entry.generated > 0 ? Math.round((entry.read / entry.generated) * 100) : 0;
    return {
      parentId,
      reportsGenerated: entry.generated,
      notificationsSent: entry.generated,
      readRate,
      weeklyReports: entry.generated,
      monthlyReports: Math.floor(entry.generated / 4),
      avgStudentImprovement: 12,
    };
  }
}

// ─── Cache Analytics ────────────────────────────────────────────────────────

export interface CacheTierStats {
  tier: string;
  hits: number;
  misses: number;
  hitRate: number;
  savedTokens: number;
  savedCostUsd: number;
  avgRetrievalMs: number;
}

export class CacheAnalytics {
  private static instance: CacheAnalytics;
  private tiers: Map<string, { hits: number; misses: number; savedTokens: number; totalLatencyMs: number }> = new Map();

  public static getInstance(): CacheAnalytics {
    if (!CacheAnalytics.instance) CacheAnalytics.instance = new CacheAnalytics();
    return CacheAnalytics.instance;
  }

  private ensureTier(tier: string) {
    if (!this.tiers.has(tier)) this.tiers.set(tier, { hits: 0, misses: 0, savedTokens: 0, totalLatencyMs: 0 });
    return this.tiers.get(tier)!;
  }

  public recordHit(tier: string, savedTokens: number, latencyMs: number): void {
    const t = this.ensureTier(tier);
    t.hits++;
    t.savedTokens += savedTokens;
    t.totalLatencyMs += latencyMs;
  }

  public recordMiss(tier: string): void { this.ensureTier(tier).misses++; }

  public getAllStats(): CacheTierStats[] {
    return Array.from(this.tiers.entries()).map(([tier, data]) => {
      const total = data.hits + data.misses;
      const hitRate = total > 0 ? Math.round((data.hits / total) * 100) : 0;
      const savedCostUsd = (data.savedTokens / 1000) * 0.10;
      const avgRetrievalMs = data.hits > 0 ? Math.round(data.totalLatencyMs / data.hits) : 0;
      return { tier, hits: data.hits, misses: data.misses, hitRate, savedTokens: data.savedTokens, savedCostUsd, avgRetrievalMs };
    });
  }
}

// ─── Provider Comparison Table ───────────────────────────────────────────────

export interface ProviderComparisonRow {
  providerId: string;
  requestCount: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  successRate: number;
  errorCount: number;
  fallbackCount: number;
  avgTokens: number;
  cacheHitRate: number;
  availability: number;
}

export class ProviderComparison {
  private static instance: ProviderComparison;
  public static getInstance(): ProviderComparison {
    if (!ProviderComparison.instance) ProviderComparison.instance = new ProviderComparison();
    return ProviderComparison.instance;
  }

  public getComparisonTable(): ProviderComparisonRow[] {
    const monitor = ProviderMonitor.getInstance();
    return monitor.getAllStats().map(p => ({
      providerId: p.providerId,
      requestCount: p.requestCount,
      avgLatencyMs: monitor.getAverageLatency(p.providerId),
      estimatedCostUsd: p.estimatedCostUsd,
      successRate: monitor.getSuccessRate(p.providerId),
      errorCount: p.failureCount,
      fallbackCount: p.fallbackCount,
      avgTokens: p.requestCount > 0 ? Math.round((p.promptTokensTotal + p.completionTokensTotal) / p.requestCount) : 0,
      cacheHitRate: monitor.getCacheHitRate(p.providerId),
      availability: monitor.getSuccessRate(p.providerId),
    }));
  }
}
