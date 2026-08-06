import { GeminiPoolManager } from "../../gateway/GeminiPoolManager";
import { ProviderMonitor } from "./ProviderMonitor";

export interface GeminiKeyView {
  displayName: string;  // "Gemini #1" — never the key value
  keyId: string;
  status: string;
  health: string;
  dailyRequests: number;
  minuteRequests: number;
  dailyTokens: number;
  minuteTokens: number;
  averageLatencyMs: number;
  cooldownRemainingSeconds: number | null;
  lastError: string | null;
  score: number;
  remainingQuota: number;
}

export interface GeminiClusterSummary {
  totalKeys: number;
  healthyKeys: number;
  coolingDownKeys: number;
  disabledKeys: number;
  currentActiveKey: string;
  averageLatencyMs: number;
  averageSuccessRate: number;
  totalDailyRequests: number;
  totalDailyTokens: number;
  totalDailyEstimatedCostUsd: number;
  averageCacheHitRate: number;
  keys: GeminiKeyView[];
}

export class GeminiClusterDashboard {
  private static instance: GeminiClusterDashboard;

  public static getInstance(): GeminiClusterDashboard {
    if (!GeminiClusterDashboard.instance) {
      GeminiClusterDashboard.instance = new GeminiClusterDashboard();
    }
    return GeminiClusterDashboard.instance;
  }

  public getSummary(): GeminiClusterSummary {
    const pool = GeminiPoolManager.getInstance();
    const monitor = ProviderMonitor.getInstance();
    const allStats = pool.getAllAccountStats();

    const now = Date.now();
    let displayIndex = 1;

    const keys: GeminiKeyView[] = allStats.map(acc => {
      const cooldownSeconds =
        acc.health === "CoolingDown" && acc.cooldownUntil
          ? Math.max(0, Math.round((acc.cooldownUntil - now) / 1000))
          : null;

      return {
        displayName: `Gemini #${displayIndex++}`,
        keyId: acc.keyId,
        status: acc.health === "Healthy" ? "Active" : acc.health,
        health: acc.health,
        dailyRequests: acc.requestsToday,
        minuteRequests: acc.requestsThisMinute,
        dailyTokens: acc.tokensToday,
        minuteTokens: acc.tokensThisMinute,
        averageLatencyMs: acc.averageLatencyMs,
        cooldownRemainingSeconds: cooldownSeconds,
        lastError: acc.lastError,
        score: Math.round(pool.calculateAccountScore(acc as any)),
        remainingQuota: acc.remainingQuota,
      };
    });

    const geminiMonitor = monitor.getStats("gemini");
    const healthy = keys.filter(k => k.health === "Healthy").length;
    const cooling = keys.filter(k => k.health === "CoolingDown").length;
    const disabled = keys.filter(k => k.health === "Disabled").length;

    const avgLatency = keys.length > 0
      ? Math.round(keys.reduce((s, k) => s + k.averageLatencyMs, 0) / keys.length)
      : 0;

    const totalDailyRequests = keys.reduce((s, k) => s + k.dailyRequests, 0);
    const totalDailyTokens = keys.reduce((s, k) => s + k.dailyTokens, 0);

    const activeKey = pool.selectBestAccount();

    return {
      totalKeys: keys.length,
      healthyKeys: healthy,
      coolingDownKeys: cooling,
      disabledKeys: disabled,
      currentActiveKey: activeKey?.keyId ?? "none",
      averageLatencyMs: avgLatency,
      averageSuccessRate: monitor.getSuccessRate("gemini"),
      totalDailyRequests,
      totalDailyTokens,
      totalDailyEstimatedCostUsd: geminiMonitor.estimatedCostUsd,
      averageCacheHitRate: monitor.getCacheHitRate("gemini"),
      keys,
    };
  }
}
