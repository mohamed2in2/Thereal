import { FeatureFlags } from "../controls/FeatureFlags";
import { PromptLibrary } from "../prompts/PromptLibrary";
import { ConfigManager } from "../../config/AIConfig";

export interface AIBackupSnapshot {
  version: string;
  createdAt: Date;
  featureFlags: Record<string, string>;
  promptIdentity: string;
  config: Record<string, unknown>;
}

export class AIBackupRestore {
  public static createBackup(): AIBackupSnapshot {
    const featureFlags = FeatureFlags.getInstance().getAllFlags();
    const promptIdentity = PromptLibrary.getInstance().getActivePrompt("identity");
    const config = ConfigManager.getInstance().getConfig();

    return {
      version: "1.0.0",
      createdAt: new Date(),
      featureFlags,
      promptIdentity,
      config: config as unknown as Record<string, unknown>,
    };
  }

  public static restoreBackup(snapshot: AIBackupSnapshot): boolean {
    if (!snapshot || !snapshot.version) return false;

    // Restore feature flags
    const flags = FeatureFlags.getInstance();
    for (const [k, v] of Object.entries(snapshot.featureFlags)) {
      flags.setFeatureMode(k, v as any);
    }

    // Restore prompt
    PromptLibrary.getInstance().createPromptVersion("identity", snapshot.promptIdentity, "RestoreSystem", "Restored from backup snapshot");

    return true;
  }
}
