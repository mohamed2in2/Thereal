export type CostMode = "Economy" | "Balanced" | "Quality";

export interface CostModeConfig {
  mode: CostMode;
  maxTokensMultiplier: number;
  useAggressiveCache: boolean;
  truncateHistoryLength: number;
}

export class AdaptiveCostMode {
  private static instance: AdaptiveCostMode;
  private currentMode: CostMode = "Balanced";

  public static getInstance(): AdaptiveCostMode {
    if (!AdaptiveCostMode.instance) {
      AdaptiveCostMode.instance = new AdaptiveCostMode();
    }
    return AdaptiveCostMode.instance;
  }

  public getMode(): CostMode {
    return this.currentMode;
  }

  public setMode(mode: CostMode): void {
    this.currentMode = mode;
  }

  public getModeConfig(): CostModeConfig {
    switch (this.currentMode) {
      case "Economy":
        return {
          mode: "Economy",
          maxTokensMultiplier: 0.6,
          useAggressiveCache: true,
          truncateHistoryLength: 3,
        };
      case "Quality":
        return {
          mode: "Quality",
          maxTokensMultiplier: 1.5,
          useAggressiveCache: false,
          truncateHistoryLength: 10,
        };
      case "Balanced":
      default:
        return {
          mode: "Balanced",
          maxTokensMultiplier: 1.0,
          useAggressiveCache: true,
          truncateHistoryLength: 5,
        };
    }
  }
}
