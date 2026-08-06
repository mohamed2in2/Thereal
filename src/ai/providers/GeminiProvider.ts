import { BaseProvider } from "./BaseProvider";
import { GeminiPoolManager } from "../gateway/GeminiPoolManager";
import { GenerateOptions, GenerateResult, ProviderCapabilities, StreamChunk, StreamResult } from "../types";

export class GeminiProvider extends BaseProvider {
  public id = "gemini";
  public name = "Google Gemini Pool Provider";
  public capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: true,
    maxContextTokens: 128000,
  };

  private poolManager: GeminiPoolManager;

  constructor() {
    super();
    this.poolManager = GeminiPoolManager.getInstance();
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const promptText = this.extractPromptText(options.prompt);
    const inputTokens = this.estimateTokens(promptText);

    // Select optimal Gemini key from multi-account pool
    const selectedAccount = this.poolManager.selectBestAccount();

    // If sandbox / test mode or secret key unavailable
    if (selectedAccount.secretKey.includes("sandbox") || process.env.NODE_ENV === "test") {
      const simulatedText = `[Google Gemini Pool (${selectedAccount.keyId})]: تم توليد الشرح والتحليل التعليمي المتقدم بذكاء فائق للمنهج المصري.`;
      const outputTokens = this.estimateTokens(simulatedText);
      const latency = Date.now() - startTime;

      this.poolManager.recordSuccess(selectedAccount.keyId, inputTokens + outputTokens, latency);

      return {
        text: simulatedText,
        providerId: this.id,
        providerName: this.name,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: latency,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": selectedAccount.secretKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }],
              },
            ],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.status === 429) {
        this.poolManager.recordRateLimit(selectedAccount.keyId, 60000);
        throw new Error(`429 Rate Limit on Gemini account ${selectedAccount.keyId}`);
      }

      if (response.status === 401 || response.status === 403) {
        this.poolManager.recordUnauthorized(selectedAccount.keyId);
        throw new Error(`401/403 Unauthorized on Gemini account ${selectedAccount.keyId}`);
      }

      if (response.status >= 500) {
        this.poolManager.recordServerError(selectedAccount.keyId, `Status ${response.status}`);
        throw new Error(`5xx Server Error on Gemini account ${selectedAccount.keyId}`);
      }

      if (!response.ok) {
        throw new Error(`Gemini API Error (${response.status})`);
      }

      const data = await response.json();
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const outputTokens = this.estimateTokens(textResult);
      const latency = Date.now() - startTime;

      this.poolManager.recordSuccess(selectedAccount.keyId, inputTokens + outputTokens, latency);

      return {
        text: textResult,
        providerId: this.id,
        providerName: this.name,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: latency,
      };
    } catch (err: any) {
      console.warn(`[GeminiProvider] Key '${selectedAccount.keyId}' failed (${err?.message}). Throwing error for fallback chain.`);
      throw err instanceof Error ? err : new Error(String(err));
    }
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
}
