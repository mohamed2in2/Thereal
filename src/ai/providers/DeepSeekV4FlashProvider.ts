import { BaseProvider } from "./BaseProvider";
import { GenerateOptions, GenerateResult, ProviderCapabilities, StreamChunk, StreamResult } from "../types";

export class DeepSeekV4FlashProvider extends BaseProvider {
  public id = "deepseek_v4_flash";
  public name = "DeepSeek V4 Flash Provider";
  public capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: false,
    maxContextTokens: 64000,
  };

  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options?: { id?: string; apiKey?: string; baseUrl?: string; model?: string }) {
    super();
    if (options?.id) this.id = options.id;
    this.apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY || "YnaFQDjz3mNWZi0KiPrM-HcslcqyWDB9";
    this.baseUrl = (options?.baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
    this.model = options?.model || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const promptText = this.extractPromptText(options.prompt);
    const systemInstruction = typeof options.prompt === "object"
      ? `${options.prompt.identity}\n${options.prompt.teachingStyle}\n${options.prompt.subjectRules}`
      : options.systemPrompt;

    const inputTokens = this.estimateTokens(promptText);

    // If API key is missing or test execution environment
    if (!this.apiKey || this.apiKey === "mock" || process.env.NODE_ENV === "test") {
      return this.generateSimulatedResult(promptText, inputTokens, startTime);
    }

    let retriesLeft = 1;
    let lastError: Error | null = null;

    while (retriesLeft >= 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
              { role: "user", content: promptText },
            ],
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new Error("Rate limit exceeded on DeepSeek V4 Flash API.");
        }

        if (response.status >= 400 && response.status < 500) {
          const errBody = await response.text();
          throw new Error(`DeepSeek API Client Error (${response.status}): ${errBody}`);
        }

        if (!response.ok) {
          throw new Error(`DeepSeek API Server Error (${response.status})`);
        }

        const data = await response.json();
        const choiceText = data.choices?.[0]?.message?.content || "";
        const usageInput = data.usage?.prompt_tokens || inputTokens;
        const usageOutput = data.usage?.completion_tokens || this.estimateTokens(choiceText);
        const totalTokens = usageInput + usageOutput;

        return {
          text: choiceText,
          providerId: this.id,
          providerName: this.name,
          inputTokens: usageInput,
          outputTokens: usageOutput,
          totalTokens,
          latencyMs: Date.now() - startTime,
        };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (lastError.message.includes("400") || lastError.message.includes("401") || lastError.message.includes("Rate limit")) {
          break;
        }

        retriesLeft--;
        if (retriesLeft < 0) break;
      }
    }

    console.warn(`[DeepSeekV4FlashProvider] Provider call failed (${lastError?.message}). Throwing error for fallback chain.`);
    throw lastError || new Error("DeepSeek V4 Flash API call failed");
  }

  public async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    const result = await this.generate(options);
    const words = result.text.split(" ");
    let fullText = "";

    for (const word of words) {
      const delta = word + " ";
      fullText += delta;
      yield { delta, done: false };
    }

    yield { delta: "", done: true };
    return {
      fullText,
      providerId: this.id,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
    };
  }

  private generateSimulatedResult(promptText: string, inputTokens: number, startTime: number): GenerateResult {
    const outputText = `[DeepSeek V4 Flash]: تم تحليل استفسارك بذكاء وتوفير الإجابة التعليمية المناسبة بناءً على المنهج المصري والمستوى الدراسي الحالي. (${promptText.slice(0, 30)}...)`;
    const outputTokens = this.estimateTokens(outputText);

    return {
      text: outputText,
      providerId: this.id,
      providerName: this.name,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs: Date.now() - startTime,
    };
  }
}
