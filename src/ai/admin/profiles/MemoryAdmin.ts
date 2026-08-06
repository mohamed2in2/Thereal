import { LayeredMemory } from "../../memory/LayeredMemory";

export interface MemoryRetentionPolicy {
  sessionRetentionDays: number;
  longTermProfileRetentionDays: number;
  autoCleanupEnabled: boolean;
}

export class MemoryAdmin {
  private layeredMemory: LayeredMemory;
  private retentionPolicy: MemoryRetentionPolicy = {
    sessionRetentionDays: 7,
    longTermProfileRetentionDays: 365,
    autoCleanupEnabled: true,
  };

  constructor() {
    this.layeredMemory = LayeredMemory.getInstance();
  }

  public clearStudentMemory(studentId: string): void {
    this.layeredMemory.updateLongTermProfile(studentId, {
      weakTopics: [],
      strongTopics: [],
      streakDays: 0,
      overallProgress: 0,
    });
  }

  public exportMemoryProfile(studentId: string): string {
    const profile = this.layeredMemory.getLongTermProfile(studentId);
    return JSON.stringify(profile, null, 2);
  }

  public getRetentionPolicy(): MemoryRetentionPolicy {
    return { ...this.retentionPolicy };
  }

  public setRetentionPolicy(policy: MemoryRetentionPolicy): void {
    this.retentionPolicy = { ...policy };
  }
}
