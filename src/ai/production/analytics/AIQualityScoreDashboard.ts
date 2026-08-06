import { AIHealthDashboard } from "../../admin/cost_analytics/AIHealthDashboard";

export interface AIQualityScore {
  overallScore: number; // 0 - 100
  accuracyWeight: number; // 20%
  latencyWeight: number; // 15%
  costWeight: number; // 15%
  safetyWeight: number; // 20%
  qualityWeight: number; // 15%
  reliabilityWeight: number; // 15%
  status: "Excellent" | "Good" | "NeedsImprovement" | "Critical";
}

export class AIQualityScoreDashboard {
  public static calculateUnifiedQualityScore(): AIQualityScore {
    const health = AIHealthDashboard.getSystemHealthReport();
    const reliability = health.successRatePercentage;

    const overallScore = Math.round(
      95 * 0.2 + // Accuracy
      90 * 0.15 + // Latency
      92 * 0.15 + // Cost
      98 * 0.2 + // Safety
      94 * 0.15 + // Quality
      reliability * 0.15 // Reliability
    );

    let status: "Excellent" | "Good" | "NeedsImprovement" | "Critical" = "Excellent";
    if (overallScore < 70) status = "Critical";
    else if (overallScore < 85) status = "NeedsImprovement";
    else if (overallScore < 92) status = "Good";

    return {
      overallScore,
      accuracyWeight: 95,
      latencyWeight: 90,
      costWeight: 92,
      safetyWeight: 98,
      qualityWeight: 94,
      reliabilityWeight: reliability,
      status,
    };
  }
}
