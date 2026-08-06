export interface BudgetPolicySet {
  // Global limits
  globalDailyBudgetUsd: number;
  globalMonthlyBudgetUsd: number;

  // Per-dimension limits
  perProviderDailyUsd: Record<string, number>;
  perSubjectDailyUsd: Record<string, number>;
  perGradeDailyUsd: Record<string, number>;
  perStudentDailyUsd: number;
  perTeacherDailyUsd: number;
  perActionDailyUsd: Record<string, number>;
  perApiKeyDailyUsd: Record<string, number>;

  // Thresholds (0–1)
  warningThreshold: number;    // 0.50 → show warning
  economyThreshold: number;    // 0.75 → Economy Mode
  degradedThreshold: number;   // 0.90 → reduce quality
  criticalThreshold: number;   // 0.95 → disable expensive actions
  emergencyThreshold: number;  // 1.00 → emergency policy

  // Emergency policy
  emergencyPolicy: "reject" | "deepseek" | "gemini" | "cache_only";

  // Cost rate per 1K tokens per provider
  costPer1KTokens: Record<string, number>;
}

export class BudgetPolicies {
  private static instance: BudgetPolicies;
  private policy: BudgetPolicySet;

  private constructor() {
    this.policy = {
      globalDailyBudgetUsd: 50.0,
      globalMonthlyBudgetUsd: 1000.0,
      perProviderDailyUsd: {
        deepseek_v4_flash: 20.0,
        gemini: 20.0,
        groq: 10.0,
        mock: 9999,
      },
      perSubjectDailyUsd: {
        "الفيزياء": 8.0,
        "الرياضيات": 8.0,
        "الكيمياء": 8.0,
        "اللغة العربية": 6.0,
        "default": 5.0,
      },
      perGradeDailyUsd: {
        "الصف الأول الثانوي": 10.0,
        "الصف الثاني الثانوي": 10.0,
        "الصف الثالث الثانوي": 15.0,
        "default": 8.0,
      },
      perStudentDailyUsd: 1.5,
      perTeacherDailyUsd: 5.0,
      perActionDailyUsd: {
        EXAM: 10.0,
        PLAN: 5.0,
        TEACHER_REPORT: 5.0,
        PARENT_REPORT: 3.0,
        EXPLAIN: 8.0,
        QUIZ: 5.0,
        default: 3.0,
      },
      perApiKeyDailyUsd: {},
      warningThreshold: 0.50,
      economyThreshold: 0.75,
      degradedThreshold: 0.90,
      criticalThreshold: 0.95,
      emergencyThreshold: 1.00,
      emergencyPolicy: "cache_only",
      costPer1KTokens: {
        deepseek_v4_flash: 0.14,
        gemini: 0.075,
        groq: 0.05,
        mock: 0,
        default: 0.10,
      },
    };
  }

  public static getInstance(): BudgetPolicies {
    if (!BudgetPolicies.instance) {
      BudgetPolicies.instance = new BudgetPolicies();
    }
    return BudgetPolicies.instance;
  }

  public getPolicy(): BudgetPolicySet { return this.policy; }

  public updatePolicy(patch: Partial<BudgetPolicySet>): void {
    this.policy = { ...this.policy, ...patch };
  }

  public getCostPer1KTokens(providerId: string): number {
    return this.policy.costPer1KTokens[providerId] ?? this.policy.costPer1KTokens["default"] ?? 0.10;
  }

  public estimateCostUsd(providerId: string, estimatedTokens: number): number {
    return (estimatedTokens / 1000) * this.getCostPer1KTokens(providerId);
  }
}
