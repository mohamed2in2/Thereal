import {
  AIProvider,
  EmbedResult,
  GenerateOptions,
  GenerateResult,
  ProviderCapabilities,
  StreamChunk,
  StreamResult,
} from "../types";

export abstract class BaseProvider implements AIProvider {
  public abstract id: string;
  public abstract name: string;
  public abstract capabilities: ProviderCapabilities;

  public abstract generate(options: GenerateOptions): Promise<GenerateResult>;

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

  public async embed(text: string | string[]): Promise<EmbedResult> {
    const inputs = Array.isArray(text) ? text : [text];
    const dimensions = 1536;
    const embeddings = inputs.map(() =>
      Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
    );

    return {
      embeddings,
      dimensions,
      providerId: this.id,
    };
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }

  public estimateTokens(text: string): number {
    if (!text) return 0;
    // Approximating ~4 chars per token for Latin script, ~2 chars per token for Arabic
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const otherChars = text.length - arabicChars;
    const estimated = Math.ceil(arabicChars / 2 + otherChars / 4);
    return Math.max(1, estimated);
  }

  protected extractPromptText(prompt: string | { fullPrompt: string }): string {
    return typeof prompt === "string" ? prompt : prompt.fullPrompt;
  }
}
