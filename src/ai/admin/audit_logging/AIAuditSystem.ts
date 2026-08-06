export interface AuditRecord {
  id: string;
  timestamp: Date;
  who: string;
  ip: string;
  action: string;
  previousValue: string;
  newValue: string;
  reason?: string;
}

export class AIAuditSystem {
  private static instance: AIAuditSystem;
  private auditRecords: AuditRecord[] = [];

  public static getInstance(): AIAuditSystem {
    if (!AIAuditSystem.instance) {
      AIAuditSystem.instance = new AIAuditSystem();
    }
    return AIAuditSystem.instance;
  }

  public recordChange(record: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
    const fullRecord: AuditRecord = {
      ...record,
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    };

    this.auditRecords.push(fullRecord);
    if (this.auditRecords.length > 5000) this.auditRecords.shift();

    return fullRecord;
  }

  public getAuditTrail(limit = 100): AuditRecord[] {
    return this.auditRecords.slice(-limit).reverse();
  }

  public filterByWho(who: string, limit = 50): AuditRecord[] {
    return this.auditRecords.filter(r => r.who === who).slice(-limit).reverse();
  }

  public filterByAction(action: string, limit = 50): AuditRecord[] {
    return this.auditRecords.filter(r => r.action.startsWith(action)).slice(-limit).reverse();
  }
}
