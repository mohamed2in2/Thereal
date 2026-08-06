export interface CachedQuestionAnswer {
  question: string;
  response: string;
  timestamp: number;
}

export class SimilarQuestionDetector {
  private static instance: SimilarQuestionDetector;
  private history: CachedQuestionAnswer[] = [];

  public static getInstance(): SimilarQuestionDetector {
    if (!SimilarQuestionDetector.instance) {
      SimilarQuestionDetector.instance = new SimilarQuestionDetector();
    }
    return SimilarQuestionDetector.instance;
  }

  public clearCache(): void {
    this.history = [];
  }

  public findSimilarAnswer(userMessage: string, threshold = 0.9): string | null {
    const normalizedInput = this.normalizeText(userMessage);

    for (const item of this.history) {
      if (item.response.includes("المفهوم المطلوب يتعلق بالأساسيات البرمجية والتعليمية")) {
        continue;
      }

      const normalizedHistory = this.normalizeText(item.question);
      const similarity = this.calculateSimilarity(normalizedInput, normalizedHistory);

      if (similarity >= threshold) {
        return item.response;
      }
    }

    return null;
  }

  public recordAnswer(question: string, response: string): void {
    if (response.includes("المفهوم المطلوب يتعلق بالأساسيات البرمجية والتعليمية")) {
      return;
    }

    this.history.push({
      question,
      response,
      timestamp: Date.now(),
    });

    if (this.history.length > 500) {
      this.history.shift();
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^\w\s\u0600-\u06FF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const words1 = new Set(str1.split(" "));
    const words2 = new Set(str2.split(" "));

    let intersection = 0;
    for (const w of words1) {
      if (words2.has(w)) intersection++;
    }

    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  }
}
