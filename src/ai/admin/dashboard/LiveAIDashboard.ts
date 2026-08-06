import { AIRequestExplorer } from "../explorer/AIRequestExplorer";
import { BudgetTracker } from "../budget/BudgetTracker";
import { BudgetAlerts } from "../budget/BudgetAlerts";
import { ProviderMonitor } from "../monitoring/ProviderMonitor";

export interface DashboardCard {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
}

export interface HourlyDataPoint {
  hour: string;  // "14:00"
  requests: number;
  tokens: number;
  costUsd: number;
  avgLatencyMs: number;
  errors: number;
}

export interface ProviderDistributionItem {
  providerId: string;
  requestCount: number;
  percentage: number;
}

export interface HeatmapCell {
  label: string;
  costUsd: number;
  requestCount: number;
}

export interface LiveDashboardData {
  cards: DashboardCard[];
  hourlyData: HourlyDataPoint[];
  providerDistribution: ProviderDistributionItem[];
  subjectDistribution: { subject: string; requests: number }[];
  actionDistribution: { action: string; requests: number }[];
  mostExpensiveSubjects: HeatmapCell[];
  mostExpensiveActions: HeatmapCell[];
  budgetLevel: string;
  providerHealth: { providerId: string; status: string; successRate: number }[];
}

export class LiveAIDashboard {
  private static instance: LiveAIDashboard;
  private hourlyBuckets: Map<string, HourlyDataPoint> = new Map();

  public static getInstance(): LiveAIDashboard {
    if (!LiveAIDashboard.instance) {
      LiveAIDashboard.instance = new LiveAIDashboard();
    }
    return LiveAIDashboard.instance;
  }

  public recordRequest(params: {
    hour: string;
    tokens: number;
    costUsd: number;
    latencyMs: number;
    isError: boolean;
  }): void {
    const bucket = this.hourlyBuckets.get(params.hour) || {
      hour: params.hour, requests: 0, tokens: 0, costUsd: 0, avgLatencyMs: 0, errors: 0,
    };
    bucket.requests++;
    bucket.tokens += params.tokens;
    bucket.costUsd += params.costUsd;
    bucket.avgLatencyMs = Math.round((bucket.avgLatencyMs + params.latencyMs) / 2);
    if (params.isError) bucket.errors++;
    this.hourlyBuckets.set(params.hour, bucket);
  }

  public getDashboardData(): LiveDashboardData {
    const explorer = AIRequestExplorer.getInstance();
    const tracker = BudgetTracker.getInstance();
    const alerts = BudgetAlerts.getInstance();
    const monitor = ProviderMonitor.getInstance();

    const todayStats = explorer.getTodaysStats();
    const snapshot = tracker.getSnapshot();
    const budgetLevel = alerts.getCurrentLevel();
    const allProviders = monitor.getAllStats();

    // Cards
    const cards: DashboardCard[] = [
      { label: "الطلبات اليوم", value: todayStats.totalRequests, unit: "طلب" },
      { label: "التوكنات اليوم", value: todayStats.totalTokens.toLocaleString(), unit: "token" },
      { label: "التكلفة اليوم", value: `$${snapshot.globalDailyUsd.toFixed(4)}` },
      { label: "متوسط الاستجابة", value: todayStats.avgLatencyMs, unit: "ms" },
      { label: "مستوى الميزانية", value: budgetLevel },
    ];

    // Provider distribution
    const totalRequests = allProviders.reduce((s, p) => s + p.requestCount, 0) || 1;
    const providerDistribution: ProviderDistributionItem[] = allProviders.map(p => ({
      providerId: p.providerId,
      requestCount: p.requestCount,
      percentage: Math.round((p.requestCount / totalRequests) * 100),
    }));

    // Subject distribution from snapshot
    const subjectDistribution = Object.entries(snapshot.bySubject).map(([subject, cost]) => ({
      subject, requests: Math.round(cost * 1000),
    }));

    // Action distribution
    const actionDistribution = Object.entries(snapshot.byAction).map(([action, cost]) => ({
      action, requests: Math.round(cost * 1000),
    }));

    // Heatmaps
    const mostExpensiveSubjects: HeatmapCell[] = Object.entries(snapshot.bySubject)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, costUsd]) => ({ label, costUsd, requestCount: Math.round(costUsd * 1000) }));

    const mostExpensiveActions: HeatmapCell[] = Object.entries(snapshot.byAction)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, costUsd]) => ({ label, costUsd, requestCount: Math.round(costUsd * 1000) }));

    // Provider health
    const providerHealth = allProviders.map(p => ({
      providerId: p.providerId,
      status: p.status,
      successRate: monitor.getSuccessRate(p.providerId),
    }));

    return {
      cards,
      hourlyData: Array.from(this.hourlyBuckets.values()).slice(-24),
      providerDistribution,
      subjectDistribution,
      actionDistribution,
      mostExpensiveSubjects,
      mostExpensiveActions,
      budgetLevel,
      providerHealth,
    };
  }
}
