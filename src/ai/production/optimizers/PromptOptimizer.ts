export interface OptimizedPromptResult {
  optimizedPrompt: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
}

export class PromptOptimizer {
  public static optimizePrompt(rawPrompt: string): OptimizedPromptResult {
    const originalTokens = Math.ceil(rawPrompt.length / 4);

    // Remove redundant whitespace, duplicate newlines, and trailing lines
    let optimized = rawPrompt
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    const compressedTokens = Math.ceil(optimized.length / 4);

    return {
      optimizedPrompt: optimized,
      originalTokens,
      compressedTokens,
      tokensSaved: Math.max(0, originalTokens - compressedTokens),
    };
  }
}
