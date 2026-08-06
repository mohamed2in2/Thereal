import { BudgetPolicies } from "./BudgetPolicies";
import { BudgetTracker } from "./BudgetTracker";
import { BudgetAlerts, BudgetAlertLevel } from "./BudgetAlerts";

export interface PreflightResult {
  allowed: boolean;
  reason?: string;
  suggestedProviderId?: string;
  estimatedCostUsd: number;
  budgetLevel: BudgetAlertLevel | "Normal";
  autoMode?: "economy" | "degraded" | "critical" | "emergency";
}

export class BudgetManager {
  private static instance: BudgetManager;

  public static getInstance(): BudgetManager {
    if (!BudgetManager.instance) {
      BudgetManager.instance = new BudgetManager();
    }
    return BudgetManager.instance;
  }

  /**
   * Pre-flight check: called BEFORE every AI request.
   * Estimates cost and decides allow / reject / redirect.
   */
  public preflight(params: {
    providerId: string;
    estimatedTokens: number;
    action: string;
    subject?: string;
    grade?: string;
    studentId?: string;
    teacherId?: string;
  }): PreflightResult {
    const policies = BudgetPolicies.getInstance();
    const tracker = BudgetTracker.getInstance();
    const alerts = BudgetAlerts.getInstance();

    const estimatedCostUsd = policies.estimateCostUsd(params.providerId, params.estimatedTokens);
    const budgetLevel = alerts.getCurrentLevel();

    // 1. Emergency: apply policy
    if (budgetLevel === "Emergency") {
      const ep = policies.getPolicy().emergencyPolicy;
      if (ep === "reject") {
        return { allowed: false, reason: "تجاوز الميزانية اليومية الكاملة. خدمة الذكاء الاصطناعي متوقفة مؤقتاً.", estimatedCostUsd, budgetLevel };
      }
      return { allowed: true, suggestedProviderId: ep === "cache_only" ? "mock" : ep, estimatedCostUsd, budgetLevel, autoMode: "emergency" };
    }

    // 2. Critical: disable expensive actions
    if (budgetLevel === "Critical") {
      const expensiveActions = ["EXAM", "PLAN", "TEACHER_REPORT", "PARENT_REPORT"];
      if (expensiveActions.includes(params.action)) {
        return { allowed: false, reason: `الإجراء (${params.action}) معطّل تلقائياً لتجاوز حد الميزانية الحرجة.`, estimatedCostUsd, budgetLevel, autoMode: "critical" };
      }
      return { allowed: true, suggestedProviderId: "gemini", estimatedCostUsd, budgetLevel, autoMode: "critical" };
    }

    // 3. Degraded: reduce quality, prefer cheapest provider
    if (budgetLevel === "Degraded") {
      return { allowed: true, suggestedProviderId: "gemini", estimatedCostUsd, budgetLevel, autoMode: "degraded" };
    }

    // 4. Economy: aggressive caching, prefer cheaper provider
    if (budgetLevel === "Economy") {
      return { allowed: true, suggestedProviderId: params.providerId, estimatedCostUsd, budgetLevel, autoMode: "economy" };
    }

    // 5. Per-student limit check
    const policy = policies.getPolicy();
    if (params.studentId) {
      const studentSpent = tracker.getByStudent(params.studentId);
      if (studentSpent + estimatedCostUsd > policy.perStudentDailyUsd) {
        return { allowed: false, reason: `تجاوز الطالب الحد اليومي المخصص له من الذكاء الاصطناعي ($${policy.perStudentDailyUsd}).`, estimatedCostUsd, budgetLevel };
      }
    }

    // 6. Per-provider limit check
    const providerSpent = tracker.getByProvider(params.providerId);
    const providerLimit = policy.perProviderDailyUsd[params.providerId] ?? policy.perProviderDailyUsd["default"] ?? 999;
    if (providerSpent + estimatedCostUsd > providerLimit) {
      const fallback = params.providerId === "deepseek_v4_flash" ? "gemini" : "mock";
      return { allowed: true, suggestedProviderId: fallback, estimatedCostUsd, budgetLevel, reason: `تجاوز حد المزوّد ${params.providerId}. التحويل التلقائي إلى ${fallback}.` };
    }

    // Emit alerts & allow
    alerts.checkAndEmit();
    return { allowed: true, estimatedCostUsd, budgetLevel };
  }

  public recordActualCost(params: {
    costUsd: number;
    providerId: string;
    subject?: string;
    grade?: string;
    studentId?: string;
    teacherId?: string;
    action?: string;
    apiKeyId?: string;
  }): void {
    BudgetTracker.getInstance().record(params);
    BudgetAlerts.getInstance().checkAndEmit();
  }
}
