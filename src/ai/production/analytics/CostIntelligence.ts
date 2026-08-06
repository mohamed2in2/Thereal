import { CostManager } from "../../admin/cost_analytics/CostManager";

export interface CostForecast {
  currentMonthlyCostUsd: number;
  projectedMonthlyCostUsd: number;
  savingsRecommendation?: string;
}

export class CostIntelligence {
  public static generateCostForecast(): CostForecast {
    const currentCost = CostManager.getInstance().getTotalCostUsd();
    const projectedMonthlyCostUsd = Number((currentCost * 30).toFixed(2));

    return {
      currentMonthlyCostUsd: Number(currentCost.toFixed(2)),
      projectedMonthlyCostUsd,
      savingsRecommendation: "توصية: استخدام نماذج Fast للملخصات وكروت المراجعة يقلل التكلفة بنسبة 35%.",
    };
  }
}
