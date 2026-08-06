export type AIDeploymentMode =
  | "Development"
  | "Testing"
  | "Sandbox"
  | "Staging"
  | "Production"
  | "Maintenance"
  | "Emergency";

export interface EnvironmentConfig {
  mode: AIDeploymentMode;
  allowMockFallback: boolean;
  strictTokenBudget: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  maxConcurrentRequests: number;
}

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private currentMode: AIDeploymentMode = (process.env.NODE_ENV as AIDeploymentMode) || "Development";

  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  public getMode(): AIDeploymentMode {
    return this.currentMode;
  }

  public setMode(mode: AIDeploymentMode): void {
    this.currentMode = mode;
  }

  public getConfig(): EnvironmentConfig {
    switch (this.currentMode) {
      case "Production":
        return {
          mode: "Production",
          allowMockFallback: true,
          strictTokenBudget: true,
          logLevel: "info",
          maxConcurrentRequests: 1000,
        };
      case "Staging":
        return {
          mode: "Staging",
          allowMockFallback: true,
          strictTokenBudget: false,
          logLevel: "debug",
          maxConcurrentRequests: 200,
        };
      case "Emergency":
        return {
          mode: "Emergency",
          allowMockFallback: true,
          strictTokenBudget: true,
          logLevel: "warn",
          maxConcurrentRequests: 50,
        };
      case "Development":
      default:
        return {
          mode: "Development",
          allowMockFallback: true,
          strictTokenBudget: false,
          logLevel: "debug",
          maxConcurrentRequests: 500,
        };
    }
  }
}
