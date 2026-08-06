export interface BudgetConfig {
  maxDailyCostUsd: number;
  maxHourlyCostUsd: number;
  maxCostPerStudentUsd: number;
}

export class DailyBudgetManager {
  private static instance: DailyBudgetManager;
  private config: BudgetConfig = {
    maxDailyCostUsd: 50.0,
    maxHourlyCostUsd: 10.0,
    maxCostPerStudentUsd: 2.0,
  };

  private dailySpent = 0;
  private hourlySpent = 0;
  private studentSpent: Map<string, number> = new Map();
  private lastResetDay = new Date().getDate();
  private lastResetHour = new Date().getHours();

  public static getInstance(): DailyBudgetManager {
    if (!DailyBudgetManager.instance) {
      DailyBudgetManager.instance = new DailyBudgetManager();
    }
    return DailyBudgetManager.instance;
  }

  public checkBudget(userId = "anon", estimatedCostUsd = 0.001): { allowed: boolean; reason?: string } {
    this.checkAutoReset();

    if (this.dailySpent + estimatedCostUsd > this.config.maxDailyCostUsd) {
      return { allowed: false, reason: "تجاوزت المنصة الحد الأقصى للميزانية اليومية المخصصة للذكاء الاصطناعي." };
    }

    if (this.hourlySpent + estimatedCostUsd > this.config.maxHourlyCostUsd) {
      return { allowed: false, reason: "تجاوزت المنصة الحد الأقصى للميزانية الساعية المخصصة." };
    }

    const currentStudentSpent = this.studentSpent.get(userId) || 0;
    if (currentStudentSpent + estimatedCostUsd > this.config.maxCostPerStudentUsd) {
      return { allowed: false, reason: "تجاوز الطالب الحد الأقصى للميزانية اليومية الفردية." };
    }

    return { allowed: true };
  }

  public recordSpent(userId = "anon", costUsd: number): void {
    this.checkAutoReset();
    this.dailySpent += costUsd;
    this.hourlySpent += costUsd;
    const current = this.studentSpent.get(userId) || 0;
    this.studentSpent.set(userId, current + costUsd);
  }

  private checkAutoReset(): void {
    const now = new Date();
    if (now.getDate() !== this.lastResetDay) {
      this.dailySpent = 0;
      this.studentSpent.clear();
      this.lastResetDay = now.getDate();
    }

    if (now.getHours() !== this.lastResetHour) {
      this.hourlySpent = 0;
      this.lastResetHour = now.getHours();
    }
  }

  public setConfig(newConfig: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
