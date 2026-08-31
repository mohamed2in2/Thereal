export interface CostRecord {
  timestamp: Date;
  providerId: string;
  subject: string;
  grade: string;
  action: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export class CostManager {
  private static instance: CostManager;
  private records: CostRecord[] = [];

  public static getInstance(): CostManager {
    if (!CostManager.instance) {
      CostManager.instance = new CostManager();
    }
    return CostManager.instance;
  }

  public recordCost(record: Omit<CostRecord, "timestamp">): void {
    this.records.push({ ...record, timestamp: new Date() });
    if (this.records.length > 2000) this.records.shift();
  }

  public getTotalCostUsd(): number {
    return this.records.reduce((sum, r) => sum + r.costUsd, 0);
  }

  public getCostByProvider(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const r of this.records) {
      res[r.providerId] = (res[r.providerId] || 0) + r.costUsd;
    }
    return res;
  }

  public getDailyBudgetCap(): number {
    return Infinity; // Unlimited budget: runs continuously until user-funded API credit runs out
  }

  public isBudgetExceeded(): boolean {
    return false; // Never block requests due to software budget cap
  }

  public getCostBySubject(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const r of this.records) {
      res[r.subject] = (res[r.subject] || 0) + r.costUsd;
    }
    return res;
  }
}
