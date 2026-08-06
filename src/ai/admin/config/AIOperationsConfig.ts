import { AIAuditSystem } from "../audit_logging/AIAuditSystem";
import { BudgetPolicies } from "../budget/BudgetPolicies";

export type ProviderMode = "economy" | "balanced" | "quality";

export interface AIOperationsSettings {
  // Budgets (USD)
  globalDailyBudgetUsd: number;
  globalMonthlyBudgetUsd: number;

  // Routing mode
  providerMode: ProviderMode;

  // Limits
  maxPromptTokens: number;
  maxCompletionTokens: number;
  maxConversationLength: number;
  maxContextSize: number;
  maxCacheTtlSeconds: number;
  maxRetries: number;

  // Features
  streamingEnabled: boolean;
  knowledgeLoadingEnabled: boolean;
  automaticFallbackEnabled: boolean;

  // Toggles
  enabledProviders: Record<string, boolean>;
  enabledActions: Record<string, boolean>;
  enabledSubjects: Record<string, boolean>;
  enabledGrades: Record<string, boolean>;

  // Provider priority list
  providerPriority: string[];
}

export class AIOperationsConfig {
  private static instance: AIOperationsConfig;
  private settings: AIOperationsSettings;

  private constructor() {
    this.settings = {
      globalDailyBudgetUsd: 50,
      globalMonthlyBudgetUsd: 1000,
      providerMode: "balanced",
      maxPromptTokens: 4096,
      maxCompletionTokens: 2048,
      maxConversationLength: 20,
      maxContextSize: 8192,
      maxCacheTtlSeconds: 3600,
      maxRetries: 3,
      streamingEnabled: true,
      knowledgeLoadingEnabled: true,
      automaticFallbackEnabled: true,
      enabledProviders: { deepseek_v4_flash: true, gemini: true, mock: true },
      enabledActions: {
        EXPLAIN: true, QUIZ: true, EXAM: true, PLAN: true,
        TEACHER_REPORT: true, PARENT_REPORT: true, HOMEWORK: true,
      },
      enabledSubjects: {},
      enabledGrades: {},
      providerPriority: ["deepseek_v4_flash", "gemini", "mock"],
    };
  }

  public static getInstance(): AIOperationsConfig {
    if (!AIOperationsConfig.instance) {
      AIOperationsConfig.instance = new AIOperationsConfig();
    }
    return AIOperationsConfig.instance;
  }

  public getSettings(): AIOperationsSettings { return { ...this.settings }; }

  public updateSettings(
    patch: Partial<AIOperationsSettings>,
    who: string,
    ip: string,
    reason?: string,
  ): void {
    const audit = AIAuditSystem.getInstance();
    for (const [key, newValue] of Object.entries(patch)) {
      const prevValue = (this.settings as unknown as Record<string, unknown>)[key];
      audit.recordChange({
        who,
        ip,
        action: `UPDATE_AI_CONFIG.${key}`,
        previousValue: JSON.stringify(prevValue),
        newValue: JSON.stringify(newValue),
        reason,
      });
    }

    this.settings = { ...this.settings, ...patch };

    // Sync budget policies from settings
    BudgetPolicies.getInstance().updatePolicy({
      globalDailyBudgetUsd: this.settings.globalDailyBudgetUsd,
      globalMonthlyBudgetUsd: this.settings.globalMonthlyBudgetUsd,
    });
  }

  public isProviderEnabled(providerId: string): boolean {
    return this.settings.enabledProviders[providerId] ?? true;
  }

  public isActionEnabled(action: string): boolean {
    return this.settings.enabledActions[action] ?? true;
  }

  public toggleProvider(providerId: string, enabled: boolean, who: string, ip: string): void {
    this.updateSettings({ enabledProviders: { ...this.settings.enabledProviders, [providerId]: enabled } }, who, ip, `Toggle provider ${providerId}`);
  }

  public toggleAction(action: string, enabled: boolean, who: string, ip: string): void {
    this.updateSettings({ enabledActions: { ...this.settings.enabledActions, [action]: enabled } }, who, ip, `Toggle action ${action}`);
  }
}
