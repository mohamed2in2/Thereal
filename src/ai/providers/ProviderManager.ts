import { AIProvider, GenerateOptions, GenerateResult } from "../types";
import { MockProvider } from "./MockProvider";
import { DeepSeekV4FlashProvider } from "./DeepSeekV4FlashProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import { ConfigManager } from "../config/AIConfig";

import { GeminiProvider } from "./GeminiProvider";
import { DigitalOceanProvider } from "./DigitalOceanProvider";

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private primaryProviderId: string;
  private fallbackChain: string[];

  constructor(primaryId?: string, fallbacks?: string[]) {
    const config = ConfigManager.getInstance().getConfig();
    this.primaryProviderId = primaryId || config.primaryProvider || "gemini";
    this.fallbackChain = fallbacks || config.fallbackProviders || ["digitalocean", "gemini", "mock", "deepseek_v4_flash", "deepseek"];

    // Register built-in default providers
    this.registerProvider(new DigitalOceanProvider());
    this.registerProvider(new MockProvider());
    this.registerProvider(new DeepSeekV4FlashProvider());
    this.registerProvider(new DeepSeekV4FlashProvider({ id: "deepseek" }));
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OpenAICompatibleProvider({ id: "openai_compatible", name: "OpenAI Compatible Stub" }));

    // Register provider stubs for platforms not already registered
    const stubs = [
      { id: "openai", name: "OpenAI Provider" },
      { id: "claude", name: "Anthropic Claude Provider" },
      { id: "qwen", name: "Alibaba Qwen Provider" },
      { id: "grok", name: "xAI Grok Provider" },
      { id: "openrouter", name: "OpenRouter Provider" },
    ];
    for (const stub of stubs) {
      if (!this.providers.has(stub.id)) {
        this.registerProvider(new OpenAICompatibleProvider(stub));
      }
    }
  }

  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id?: string): AIProvider {
    const targetId = id || this.primaryProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      // Fall back to mock provider if requested provider is missing
      const mock = this.providers.get("mock");
      if (mock) return mock;
      throw new Error(`Provider with ID '${targetId}' not registered.`);
    }
    return provider;
  }

  public setPrimaryProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set primary provider: Provider '${id}' is not registered.`);
    }
    this.primaryProviderId = id;
  }

  public setFallbackChain(chain: string[]): void {
    this.fallbackChain = [...chain];
  }

  public getRegisteredProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Generates content using the primary provider.
   * If primary fails, automatically attempts fallbacks in order.
   */
  public async generateWithFallback(options: GenerateOptions): Promise<{
    result: GenerateResult;
    retriesCount: number;
    usedFallback: boolean;
  }> {
    const candidates = [this.primaryProviderId, ...this.fallbackChain];
    const uniqueCandidates = Array.from(new Set(candidates));

    let lastError: Error | null = null;
    let retriesCount = 0;

    for (let i = 0; i < uniqueCandidates.length; i++) {
      const providerId = uniqueCandidates[i];
      const provider = this.providers.get(providerId);

      if (!provider) continue;

      try {
        const result = await provider.generate(options);
        return {
          result,
          retriesCount,
          usedFallback: i > 0,
        };
      } catch (err: unknown) {
        retriesCount++;
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[ProviderManager] Provider '${providerId}' failed. Attempting next fallback... Error:`, lastError.message);
      }
    }

    throw new Error(
      `All providers in fallback chain failed. Last error: ${lastError?.message || "Unknown error"}`
    );
  }

  public async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [id, provider] of this.providers.entries()) {
      try {
        results[id] = await provider.healthCheck();
      } catch {
        results[id] = false;
      }
    }
    return results;
  }
}
