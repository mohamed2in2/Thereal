export interface SpendingSnapshot {
  globalDailyUsd: number;
  globalMonthlyUsd: number;
  byProvider: Record<string, number>;
  bySubject: Record<string, number>;
  byGrade: Record<string, number>;
  byStudent: Record<string, number>;
  byTeacher: Record<string, number>;
  byAction: Record<string, number>;
  byApiKey: Record<string, number>;
  lastResetDay: number;
  lastResetMonth: number;
}

export class BudgetTracker {
  private static instance: BudgetTracker;
  private spending: SpendingSnapshot;

  private constructor() {
    const now = new Date();
    this.spending = {
      globalDailyUsd: 0,
      globalMonthlyUsd: 0,
      byProvider: {},
      bySubject: {},
      byGrade: {},
      byStudent: {},
      byTeacher: {},
      byAction: {},
      byApiKey: {},
      lastResetDay: now.getDate(),
      lastResetMonth: now.getMonth(),
    };
  }

  public static getInstance(): BudgetTracker {
    if (!BudgetTracker.instance) {
      BudgetTracker.instance = new BudgetTracker();
    }
    return BudgetTracker.instance;
  }

  public record(dimensions: {
    costUsd: number;
    providerId: string;
    subject?: string;
    grade?: string;
    studentId?: string;
    teacherId?: string;
    action?: string;
    apiKeyId?: string;
  }): void {
    this.checkAutoReset();
    const { costUsd, providerId, subject, grade, studentId, teacherId, action, apiKeyId } = dimensions;

    this.spending.globalDailyUsd += costUsd;
    this.spending.globalMonthlyUsd += costUsd;
    this.spending.byProvider[providerId] = (this.spending.byProvider[providerId] || 0) + costUsd;
    if (subject) this.spending.bySubject[subject] = (this.spending.bySubject[subject] || 0) + costUsd;
    if (grade) this.spending.byGrade[grade] = (this.spending.byGrade[grade] || 0) + costUsd;
    if (studentId) this.spending.byStudent[studentId] = (this.spending.byStudent[studentId] || 0) + costUsd;
    if (teacherId) this.spending.byTeacher[teacherId] = (this.spending.byTeacher[teacherId] || 0) + costUsd;
    if (action) this.spending.byAction[action] = (this.spending.byAction[action] || 0) + costUsd;
    if (apiKeyId) this.spending.byApiKey[apiKeyId] = (this.spending.byApiKey[apiKeyId] || 0) + costUsd;
  }

  public getSnapshot(): SpendingSnapshot { return { ...this.spending }; }
  public getGlobalDaily(): number { return this.spending.globalDailyUsd; }
  public getGlobalMonthly(): number { return this.spending.globalMonthlyUsd; }
  public getByStudent(id: string): number { return this.spending.byStudent[id] || 0; }
  public getByProvider(id: string): number { return this.spending.byProvider[id] || 0; }
  public getByAction(action: string): number { return this.spending.byAction[action] || 0; }

  private checkAutoReset(): void {
    const now = new Date();
    if (now.getDate() !== this.spending.lastResetDay) {
      this.spending.globalDailyUsd = 0;
      this.spending.byProvider = {};
      this.spending.bySubject = {};
      this.spending.byGrade = {};
      this.spending.byStudent = {};
      this.spending.byTeacher = {};
      this.spending.byAction = {};
      this.spending.byApiKey = {};
      this.spending.lastResetDay = now.getDate();
    }
    if (now.getMonth() !== this.spending.lastResetMonth) {
      this.spending.globalMonthlyUsd = 0;
      this.spending.lastResetMonth = now.getMonth();
    }
  }
}
