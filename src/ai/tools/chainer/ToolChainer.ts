import { ToolRegistry } from "../registry/ToolRegistry";
import { PermissionManager } from "../permissions/PermissionManager";
import { ToolCache } from "../cache/ToolCache";
import { ToolObservability } from "../observability/ToolObservability";
import { ToolExecutionContext, ToolExecutionResult } from "../types";

export interface ToolChainStep {
  toolName: string;
  params?: Record<string, unknown>;
}

export class ToolChainer {
  private registry: ToolRegistry;
  private cache: ToolCache;
  private observability: ToolObservability;

  constructor(registry?: ToolRegistry) {
    this.registry = registry || ToolRegistry.getInstance();
    this.cache = ToolCache.getInstance();
    this.observability = ToolObservability.getInstance();
  }

  public async executeChain(
    context: ToolExecutionContext,
    steps: ToolChainStep[]
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const step of steps) {
      const tool = this.registry.getTool(step.toolName);
      if (!tool) {
        results.push({
          success: false,
          data: null,
          error: `Tool '${step.toolName}' not found in registry.`,
          executionTimeMs: 0,
        });
        continue;
      }

      // Permission Check
      try {
        PermissionManager.checkPermission(tool, context.userRole);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.observability.logExecution({
          toolName: tool.name,
          userId: context.userId,
          userRole: context.userRole,
          executionTimeMs: 0,
          success: false,
          cacheHit: false,
          error: errorMsg,
        });
        results.push({
          success: false,
          data: null,
          error: errorMsg,
          executionTimeMs: 0,
        });
        continue;
      }

      // Cache Lookup
      const cacheKey = `${tool.name}_${context.userId}_${JSON.stringify(step.params || {})}`;
      if (tool.cacheable) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          this.observability.logExecution({
            toolName: tool.name,
            userId: context.userId,
            userRole: context.userRole,
            executionTimeMs: cached.executionTimeMs,
            success: true,
            cacheHit: true,
          });
          results.push(cached);
          continue;
        }
      }

      // Execute Tool
      const startTime = Date.now();
      try {
        const res = await tool.execute(context, step.params);
        const duration = Date.now() - startTime;

        if (tool.cacheable && res.success) {
          this.cache.set(cacheKey, res, tool.ttlMs);
        }

        this.observability.logExecution({
          toolName: tool.name,
          userId: context.userId,
          userRole: context.userRole,
          executionTimeMs: duration,
          success: res.success,
          cacheHit: false,
          error: res.error,
        });

        results.push(res);
      } catch (err: unknown) {
        const duration = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.observability.logExecution({
          toolName: tool.name,
          userId: context.userId,
          userRole: context.userRole,
          executionTimeMs: duration,
          success: false,
          cacheHit: false,
          error: errorMsg,
        });
        results.push({
          success: false,
          data: null,
          error: errorMsg,
          executionTimeMs: duration,
        });
      }
    }

    return results;
  }
}
