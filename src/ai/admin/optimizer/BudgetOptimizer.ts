import { BudgetTracker } from "../budget/BudgetTracker";
import { AIRequestExplorer } from "../explorer/AIRequestExplorer";

export interface OptimizationRecommendation {
  category: "cache" | "prompt_compression" | "provider_routing" | "knowledge" | "action_disable";
  title: string;
  description: string;
  estimatedSavingsUsd: number;
  priority: "High" | "Medium" | "Low";
}

export interface BudgetOptimizerReport {
  analyzedAt: string;
  totalCostUsd: number;
  potentialSavingsUsd: number;
  savingsPercent: number;
  recommendations: OptimizationRecommendation[];
}

export class BudgetOptimizer {
  private static instance: BudgetOptimizer;
  private lastReport: BudgetOptimizerReport | null = null;

  public static getInstance(): BudgetOptimizer {
    if (!BudgetOptimizer.instance) {
      BudgetOptimizer.instance = new BudgetOptimizer();
    }
    return BudgetOptimizer.instance;
  }

  public analyze(): BudgetOptimizerReport {
    const explorer = AIRequestExplorer.getInstance();
    const tracker = BudgetTracker.getInstance();
    const snapshot = tracker.getSnapshot();
    const todayStats = explorer.getTodaysStats();

    const recommendations: OptimizationRecommendation[] = [];
    let totalSavings = 0;

    // 1. Cache miss opportunity
    const allRequests = explorer.search({ limit: 500 });
    const cacheHits = allRequests.filter(r => r.cacheHit).length;
    const cacheMisses = allRequests.filter(r => !r.cacheHit).length;
    const cacheHitRate = allRequests.length > 0 ? cacheHits / allRequests.length : 0;
    if (cacheHitRate < 0.4 && cacheMisses > 0) {
      const savings = todayStats.totalCostUsd * 0.25;
      totalSavings += savings;
      recommendations.push({
        category: "cache",
        title: "زيادة مدة التخزين المؤقت",
        description: `${cacheMisses} طلب فاتته نافذة التخزين. رفع TTL من 30 دقيقة إلى ساعتين يوفر تقريباً $${savings.toFixed(4)}.`,
        estimatedSavingsUsd: savings,
        priority: "High",
      });
    }

    // 2. Expensive actions with low cache rate
    const examRequests = allRequests.filter(r => r.action === "EXAM");
    if (examRequests.length > 5) {
      const examCost = examRequests.reduce((s, r) => s + r.estimatedCostUsd, 0);
      const savings = examCost * 0.30;
      totalSavings += savings;
      recommendations.push({
        category: "action_disable",
        title: "تفعيل Economy Mode لطلبات الامتحان",
        description: `طلبات الامتحانات استهلكت $${examCost.toFixed(4)}. استخدام قوالب ثابتة يوفر 30%.`,
        estimatedSavingsUsd: savings,
        priority: "High",
      });
    }

    // 3. Prompt compression opportunity
    const largePrompts = allRequests.filter(r => r.promptTokens > 1500);
    if (largePrompts.length > 3) {
      const savings = largePrompts.reduce((s, r) => s + r.estimatedCostUsd * 0.34, 0);
      totalSavings += savings;
      recommendations.push({
        category: "prompt_compression",
        title: "ضغط السياق قبل الإرسال",
        description: `${largePrompts.length} طلب بسياق أكبر من 1500 توكن. الضغط يوفر حتى 34% من التوكنات.`,
        estimatedSavingsUsd: savings,
        priority: "Medium",
      });
    }

    // 4. Provider routing improvement
    const deepseekCost = snapshot.byProvider["deepseek_v4_flash"] || 0;
    const totalProviderCost = Object.values(snapshot.byProvider).reduce((s, v) => s + v, 0);
    if (deepseekCost / (totalProviderCost || 1) > 0.6) {
      const savings = deepseekCost * 0.15;
      totalSavings += savings;
      recommendations.push({
        category: "provider_routing",
        title: "توجيه بعض الطلبات البسيطة إلى Gemini",
        description: `DeepSeek يستهلك ${Math.round((deepseekCost / (totalProviderCost || 1)) * 100)}% من الميزانية. Gemini أرخص للطلبات القصيرة.`,
        estimatedSavingsUsd: savings,
        priority: "Medium",
      });
    }

    const report: BudgetOptimizerReport = {
      analyzedAt: new Date().toISOString(),
      totalCostUsd: todayStats.totalCostUsd,
      potentialSavingsUsd: totalSavings,
      savingsPercent: todayStats.totalCostUsd > 0 ? Math.round((totalSavings / todayStats.totalCostUsd) * 100) : 0,
      recommendations: recommendations.sort((a, b) => b.estimatedSavingsUsd - a.estimatedSavingsUsd),
    };

    this.lastReport = report;
    return report;
  }

  public getLastReport(): BudgetOptimizerReport | null { return this.lastReport; }
}

// ─── AI Financial Advisor ──────────────────────────────────────────────────

export interface FinancialAdvisorReport {
  date: string;
  generatedAt: string;
  totalCostUsd: number;
  potentialSavingsUsd: number;
  savingsPercent: number;
  reasons: string[];
  recommendations: { rank: number; action: string }[];
}

export class AIFinancialAdvisor {
  private static instance: AIFinancialAdvisor;
  private lastReport: FinancialAdvisorReport | null = null;

  public static getInstance(): AIFinancialAdvisor {
    if (!AIFinancialAdvisor.instance) {
      AIFinancialAdvisor.instance = new AIFinancialAdvisor();
    }
    return AIFinancialAdvisor.instance;
  }

  public generateMidnightReport(): FinancialAdvisorReport {
    const optimizer = BudgetOptimizer.getInstance();
    const optimizerReport = optimizer.analyze();
    const explorer = AIRequestExplorer.getInstance();
    const todayStats = explorer.getTodaysStats();
    const allRequests = explorer.search({ limit: 1000 });

    const reasons: string[] = [];
    const allCacheHits = allRequests.filter(r => r.cacheHit).length;
    const cacheMisses = allRequests.length - allCacheHits;
    if (cacheMisses > 50) {
      reasons.push(`${cacheMisses} طلب متكرر كان يمكن تقديمه من التخزين المؤقت.`);
    }

    const largePrompts = allRequests.filter(r => r.promptTokens > 1500);
    if (largePrompts.length > 0) {
      const avgOversize = Math.round(((largePrompts.reduce((s, r) => s + r.promptTokens, 0) / largePrompts.length) - 1000) / 1000 * 34);
      reasons.push(`متوسط حجم الـ prompt كان ${avgOversize}% أكبر من اللازم.`);
    }

    const examRequests = allRequests.filter(r => r.action === "EXAM");
    if (examRequests.length > 0) {
      const examTokens = examRequests.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);
      const totalTokens = todayStats.totalTokens || 1;
      reasons.push(`طلبات الامتحانات استهلكت ${Math.round((examTokens / totalTokens) * 100)}% من التوكنات.`);
    }

    const fallbacks = allRequests.filter(r => r.fallbackUsed);
    if (fallbacks.length > 0) {
      reasons.push(`${fallbacks.length} طلب استخدم مزوّداً احتياطياً بتكلفة أعلى.`);
    }

    const recommendations = optimizerReport.recommendations.map((r, i) => ({
      rank: i + 1,
      action: r.title,
    }));

    const report: FinancialAdvisorReport = {
      date: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      totalCostUsd: optimizerReport.totalCostUsd,
      potentialSavingsUsd: optimizerReport.potentialSavingsUsd,
      savingsPercent: optimizerReport.savingsPercent,
      reasons,
      recommendations,
    };

    this.lastReport = report;
    return report;
  }

  public getLastReport(): FinancialAdvisorReport | null { return this.lastReport; }

  public formatReport(report: FinancialAdvisorReport): string {
    const lines = [
      `📊 تقرير المستشار المالي للذكاء الاصطناعي — ${report.date}`,
      ``,
      `💰 تكلفة أمس: $${report.totalCostUsd.toFixed(4)}`,
      `💡 توفير محتمل: $${report.potentialSavingsUsd.toFixed(4)} (${report.savingsPercent}%)`,
      ``,
      `📋 الأسباب:`,
      ...report.reasons.map((r, i) => `  ${i + 1}. ${r}`),
      ``,
      `✅ التوصيات:`,
      ...report.recommendations.map(r => `  ${r.rank}. ${r.action}`),
    ];
    return lines.join("\n");
  }
}
