import { ProviderManager } from "../providers/ProviderManager";
import { ABTester } from "./ABTester";
import { RateLimiter } from "./RateLimiter";
import { TaskModelRouter } from "./TaskModelRouter";
import { EducationalActionType, GenerateOptions, GenerateResult } from "../types";

export interface GatewayExecutionResult {
  result: GenerateResult;
  modelTier: string;
  costEstimateUsd: number;
  rateLimitStatus: { remaining: number };
  abVariant: string;
}

export class AIGateway {
  private providerManager: ProviderManager;
  private rateLimiter: RateLimiter;
  private modelRouter: TaskModelRouter;
  private abTester: ABTester;
  private costPer1kInput = 0.0015; // USD
  private costPer1kOutput = 0.006;  // USD

  constructor(providerManager?: ProviderManager) {
    this.providerManager = providerManager || new ProviderManager();
    this.rateLimiter = new RateLimiter();
    this.modelRouter = new TaskModelRouter();
    this.abTester = ABTester.getInstance();
  }

  public async executeRequest(
    userId: string,
    action: EducationalActionType,
    options: GenerateOptions
  ): Promise<GatewayExecutionResult> {
    // 1. Rate Limiting Check
    const rateCheck = this.rateLimiter.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded for user '${userId}'. Reset in ${Math.ceil(rateCheck.resetMs / 1000)}s.`);
    }

    // 2. Task Model Routing
    const modelSelection = this.modelRouter.routeTask(action);

    // 3. A/B Testing Variant Selection
    const abResult = this.abTester.getVariant(userId);

    // 4. Provider Generation with Fallback
    const { result } = await this.providerManager.generateWithFallback(options);

    // 5. Cost & Token Accounting
    const costEstimateUsd =
      (result.inputTokens / 1000) * this.costPer1kInput +
      (result.outputTokens / 1000) * this.costPer1kOutput;

    return {
      result,
      modelTier: modelSelection.tier,
      costEstimateUsd,
      rateLimitStatus: { remaining: rateCheck.remainingRequests },
      abVariant: abResult.variant,
    };
  }

  public getProviderManager(): ProviderManager {
    return this.providerManager;
  }
}
