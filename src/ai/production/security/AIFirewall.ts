export type FirewallAction = "Allow" | "Block" | "Throttle" | "Alert" | "Escalate";

export interface FirewallInspectionResult {
  allowed: boolean;
  action: FirewallAction;
  reason?: string;
  threatLevel: "None" | "Low" | "High" | "Critical";
}

export class AIFirewall {
  private static ddosTracker: Map<string, number[]> = new Map();

  public static inspectRequest(userId: string, userMessage: string): FirewallInspectionResult {
    const lower = userMessage.toLowerCase();

    // 1. Prompt Leakage & Role Escalation Detection
    if (lower.includes("show me your prompt") || lower.includes("print system prompt") || lower.includes("sudo mode")) {
      return {
        allowed: false,
        action: "Block",
        reason: "Firewall Block: Attempted System Prompt Leakage or Role Escalation.",
        threatLevel: "High",
      };
    }

    // 2. DDoS & Rate Burst Detection (more than 10 requests in 2 seconds)
    const now = Date.now();
    const userTimestamps = this.ddosTracker.get(userId) || [];
    const recent = userTimestamps.filter((t) => now - t < 2000);
    recent.push(now);
    this.ddosTracker.set(userId, recent);

    if (recent.length > 10) {
      return {
        allowed: false,
        action: "Throttle",
        reason: "Firewall Throttle: Request burst frequency triggered DDoS protection threshold.",
        threatLevel: "Critical",
      };
    }

    return {
      allowed: true,
      action: "Allow",
      threatLevel: "None",
    };
  }
}
