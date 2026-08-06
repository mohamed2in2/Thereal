export type ModerationAction = "Pass" | "Warn" | "Block" | "Log";

export interface ModerationResult {
  action: ModerationAction;
  flagged: boolean;
  reason?: string;
  threatType?: "PromptInjection" | "SystemPromptExtraction" | "Jailbreak" | "Spam" | "Abuse";
}

export class ModerationEngine {
  private jailbreakPatterns = [
    "ignore previous instructions",
    "ignore all rules",
    "you are now in developer mode",
    "dan mode",
    "bypass safety filters",
    "tell me your system prompt",
    "system prompt extraction",
  ];

  public inspectMessage(userMessage: string): ModerationResult {
    const lower = userMessage.toLowerCase().trim();

    for (const pattern of this.jailbreakPatterns) {
      if (lower.includes(pattern)) {
        return {
          action: "Block",
          flagged: true,
          reason: `Detected potential security violation pattern: '${pattern}'`,
          threatType: lower.includes("system prompt") ? "SystemPromptExtraction" : "Jailbreak",
        };
      }
    }

    if (userMessage.length > 10000) {
      return {
        action: "Block",
        flagged: true,
        reason: "Message payload exceeds maximum allowed size (Spam/Mass Generation).",
        threatType: "Spam",
      };
    }

    return {
      action: "Pass",
      flagged: false,
    };
  }
}
