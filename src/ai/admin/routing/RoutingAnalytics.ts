import { GeminiPoolManager } from "../../gateway/GeminiPoolManager";
import { ProviderMonitor } from "../monitoring/ProviderMonitor";
import { BudgetAlerts } from "../budget/BudgetAlerts";

export interface RoutingDecision {
  requestId: string;
  selectedProviderId: string;
  reasons: string[];
  confidence: number;  // 0–100
  alternativesConsidered: string[];
  budgetLevel: string;
  timestamp: string;
}

export class RoutingAnalytics {
  private static instance: RoutingAnalytics;
  private decisions: RoutingDecision[] = [];

  public static getInstance(): RoutingAnalytics {
    if (!RoutingAnalytics.instance) {
      RoutingAnalytics.instance = new RoutingAnalytics();
    }
    return RoutingAnalytics.instance;
  }

  public explainSelection(params: {
    requestId: string;
    selectedProviderId: string;
    estimatedCostUsd: number;
    action: string;
  }): RoutingDecision {
    const monitor = ProviderMonitor.getInstance();
    const pool = GeminiPoolManager.getInstance();
    const budgetLevel = BudgetAlerts.getInstance().getCurrentLevel();

    const reasons: string[] = [];
    const providerStats = monitor.getStats(params.selectedProviderId);
    const successRate = monitor.getSuccessRate(params.selectedProviderId);
    const avgLatency = monitor.getAverageLatency(params.selectedProviderId);
    const cacheHitRate = monitor.getCacheHitRate(params.selectedProviderId);

    if (successRate >= 95) reasons.push(`معدل نجاح مرتفع (${successRate}%)`);
    if (avgLatency < 300) reasons.push(`متوسط زمن استجابة ممتاز (${avgLatency}ms)`);
    if (providerStats.status === "Healthy") reasons.push("المزوّد في وضع صحي (Healthy)");
    if (params.estimatedCostUsd < 0.001) reasons.push(`تكلفة منخفضة ($${params.estimatedCostUsd.toFixed(6)})`);
    if (cacheHitRate > 30) reasons.push(`معدل cache مرتفع (${cacheHitRate}%)`);
    if (budgetLevel === "Economy") reasons.push("تم اختياره تلقائياً لتوفير الميزانية (Economy Mode)");

    // Check Gemini pool score if applicable
    if (params.selectedProviderId === "gemini") {
      const selectedGeminiKey = pool.selectBestAccount();
      if (selectedGeminiKey) {
        const score = pool.calculateAccountScore(selectedGeminiKey as any);
        reasons.push(`أعلى نتيجة في مجموعة Gemini (${score.toFixed(0)}/100)`);
      }
    }

    if (reasons.length === 0) reasons.push("تم الاختيار الافتراضي بناءً على ترتيب المزوّدين");

    const confidence = Math.min(99, 70 + reasons.length * 5);
    const alternativesConsidered = ["deepseek_v4_flash", "gemini", "mock"].filter(id => id !== params.selectedProviderId);

    const decision: RoutingDecision = {
      requestId: params.requestId,
      selectedProviderId: params.selectedProviderId,
      reasons,
      confidence,
      alternativesConsidered,
      budgetLevel,
      timestamp: new Date().toISOString(),
    };

    this.decisions.push(decision);
    if (this.decisions.length > 500) this.decisions.shift();

    return decision;
  }

  public getRecentDecisions(limit = 20): RoutingDecision[] {
    return this.decisions.slice(-limit).reverse();
  }
}
