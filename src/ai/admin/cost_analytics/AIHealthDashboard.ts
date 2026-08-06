import { Telemetry } from "../../telemetry/Telemetry";

export interface SystemHealthReport {
  overallStatus: "Healthy" | "Degraded" | "Critical";
  totalRequests: number;
  successRatePercentage: number;
  averageLatencyMs: number;
  providerStatus: Record<string, "Healthy" | "Offline">;
}

export class AIHealthDashboard {
  public static getSystemHealthReport(): SystemHealthReport {
    const telemetry = Telemetry.getInstance();
    const metrics = telemetry.getMetrics();

    const successRate = metrics.totalRequests > 0
      ? (metrics.successfulRequests / metrics.totalRequests) * 100
      : 100;

    let overallStatus: "Healthy" | "Degraded" | "Critical" = "Healthy";
    if (successRate < 80) overallStatus = "Critical";
    else if (successRate < 95) overallStatus = "Degraded";

    return {
      overallStatus,
      totalRequests: metrics.totalRequests,
      successRatePercentage: Math.round(successRate),
      averageLatencyMs: Math.round(metrics.averageLatencyMs),
      providerStatus: {
        mock: "Healthy",
        openai_compatible: "Healthy",
        deepseek: "Healthy",
      },
    };
  }
}
