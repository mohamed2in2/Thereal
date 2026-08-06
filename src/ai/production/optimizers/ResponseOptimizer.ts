export interface ResponseOptimizationResult {
  cleanedText: string;
  markdownValid: boolean;
  equationsNormalized: boolean;
  estimatedReadabilityScore: number;
}

export class ResponseOptimizer {
  public static optimizeResponse(responseText: string): ResponseOptimizationResult {
    let cleaned = responseText;

    // Normalize inline LaTeX delimiters \( ... \) to $ ... $
    let equationsNormalized = false;
    if (cleaned.includes("\\(") && cleaned.includes("\\)")) {
      cleaned = cleaned.replace(/\\\((.*?)\\\)/g, (_, p1) => `$${p1}$`);
      equationsNormalized = true;
    }

    // Markdown validation basic check
    const markdownValid = !cleaned.includes("<script>") && !cleaned.includes("javascript:");

    // Readability score calculation (simple length & structure heuristic)
    const wordCount = cleaned.split(/\s+/).length;
    const readabilityScore = wordCount > 500 ? 70 : 90;

    return {
      cleanedText: cleaned,
      markdownValid,
      equationsNormalized,
      estimatedReadabilityScore: readabilityScore,
    };
  }
}
