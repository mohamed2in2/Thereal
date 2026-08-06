import { BudgetTracker } from "./BudgetTracker";
import { BudgetPolicies } from "./BudgetPolicies";

export type BudgetAlertLevel = "Warning" | "Economy" | "Degraded" | "Critical" | "Emergency";

export interface BudgetAlert {
  id: string;
  level: BudgetAlertLevel;
  message: string;
  usagePercent: number;
  spentUsd: number;
  limitUsd: number;
  timestamp: string;
}

export class BudgetAlerts {
  private static instance: BudgetAlerts;
  private alerts: BudgetAlert[] = [];
  private emittedLevels: Set<BudgetAlertLevel> = new Set();

  public static getInstance(): BudgetAlerts {
    if (!BudgetAlerts.instance) {
      BudgetAlerts.instance = new BudgetAlerts();
    }
    return BudgetAlerts.instance;
  }

  public checkAndEmit(): BudgetAlert | null {
    const tracker = BudgetTracker.getInstance();
    const policy = BudgetPolicies.getInstance().getPolicy();
    const spent = tracker.getGlobalDaily();
    const limit = policy.globalDailyBudgetUsd;
    const ratio = spent / limit;

    let level: BudgetAlertLevel | null = null;
    let message = "";

    if (ratio >= policy.emergencyThreshold) {
      level = "Emergency";
      message = `🚨 AI Budget EMERGENCY: Daily limit $${limit} fully consumed ($${spent.toFixed(4)} spent). Emergency policy activated.`;
    } else if (ratio >= policy.criticalThreshold) {
      level = "Critical";
      message = `🔴 AI Budget CRITICAL: ${(ratio * 100).toFixed(1)}% of daily limit used. Expensive actions disabled.`;
    } else if (ratio >= policy.degradedThreshold) {
      level = "Degraded";
      message = `🟠 AI Budget DEGRADED: ${(ratio * 100).toFixed(1)}% used. Switching to reduced-quality mode.`;
    } else if (ratio >= policy.economyThreshold) {
      level = "Economy";
      message = `🟡 AI Budget Economy Mode: ${(ratio * 100).toFixed(1)}% of daily budget used.`;
    } else if (ratio >= policy.warningThreshold) {
      level = "Warning";
      message = `⚠️ AI Budget Warning: ${(ratio * 100).toFixed(1)}% of daily budget used.`;
    }

    if (level && !this.emittedLevels.has(level)) {
      const alert: BudgetAlert = {
        id: `ba_${Date.now()}`,
        level,
        message,
        usagePercent: Math.round(ratio * 100),
        spentUsd: spent,
        limitUsd: limit,
        timestamp: new Date().toISOString(),
      };
      this.alerts.push(alert);
      if (this.alerts.length > 200) this.alerts.shift();
      this.emittedLevels.add(level);
      console.warn(`[BudgetAlerts] ${message}`);
      return alert;
    }

    return null;
  }

  public getCurrentLevel(): BudgetAlertLevel | "Normal" {
    const tracker = BudgetTracker.getInstance();
    const policy = BudgetPolicies.getInstance().getPolicy();
    const ratio = tracker.getGlobalDaily() / policy.globalDailyBudgetUsd;
    if (ratio >= 1.0) return "Emergency";
    if (ratio >= 0.95) return "Critical";
    if (ratio >= 0.90) return "Degraded";
    if (ratio >= 0.75) return "Economy";
    if (ratio >= 0.50) return "Warning";
    return "Normal";
  }

  public getRecentAlerts(limit = 20): BudgetAlert[] {
    return this.alerts.slice(-limit);
  }

  public resetEmittedLevels(): void {
    this.emittedLevels.clear();
  }
}
