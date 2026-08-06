import { BaseProvider } from "./BaseProvider";
import { GenerateOptions, GenerateResult, ProviderCapabilities } from "../types";

export interface OpenAIProviderOptions {
  id?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAICompatibleProvider extends BaseProvider {
  public id: string;
  public name: string;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  public capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: true,
    maxContextTokens: 128000,
  };

  constructor(options: OpenAIProviderOptions = {}) {
    super();
    this.id = options.id || "openai_compatible";
    this.name = options.name || "OpenAI Compatible API Provider";
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.model = options.model || process.env.OPENAI_MODEL || "gpt-4o";
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const promptText = this.extractPromptText(options.prompt);
    const inputTokens = this.estimateTokens(promptText);

    // Stub behavior when key is not configured or in testing environment
    if (!this.apiKey && !process.env.ALLOW_OFFLINE_MOCK) {
      const stubText = `[${this.name} (${this.model}) Stub Response]\n` +
        `API Key not configured. The AI engine architecture successfully processed the prompt:\n\n` +
        `Prompt summary: ${promptText.slice(0, 150)}...`;
      const outputTokens = this.estimateTokens(stubText);

      return {
        text: stubText,
        providerId: this.id,
        providerName: this.name,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startTime,
        finishReason: "stop",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }]
              : []),
            { role: "user", content: promptText },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const text = data.choices[0]?.message?.content || "";
      const actualInputTokens = data.usage?.prompt_tokens ?? inputTokens;
      const actualOutputTokens = data.usage?.completion_tokens ?? this.estimateTokens(text);

      return {
        text,
        providerId: this.id,
        providerName: this.name,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        totalTokens: actualInputTokens + actualOutputTokens,
        latencyMs: Date.now() - startTime,
        finishReason: data.choices[0]?.finish_reason || "stop",
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Provider [${this.id}] generation failed: ${message}`);
    }
  }

  public override async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
