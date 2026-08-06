export interface EvaluationMetrics {
  accuracyScore: number;
  readabilityScore: number;
  hallucinationRisk: "Low" | "Medium" | "High";
  teachingQualityScore: number;
  concisenessScore: number;
  overallScore: number;
}

export class EvaluationFramework {
  public static evaluateResponse(responseText: string, expectedKeywords: string[] = []): EvaluationMetrics {
    let keywordHits = 0;
    const lower = responseText.toLowerCase();

    for (const kw of expectedKeywords) {
      if (lower.includes(kw.toLowerCase())) keywordHits++;
    }

    const accuracyScore = expectedKeywords.length > 0
      ? Math.round((keywordHits / expectedKeywords.length) * 100)
      : 95;

    const concisenessScore = responseText.length > 2000 ? 70 : 95;
    const teachingQualityScore = responseText.includes("خطوة") || responseText.includes("مثال") ? 95 : 85;

    const overallScore = Math.round(
      accuracyScore * 0.4 + concisenessScore * 0.3 + teachingQualityScore * 0.3
    );

    return {
      accuracyScore,
      readabilityScore: 90,
      hallucinationRisk: accuracyScore > 80 ? "Low" : "Medium",
      teachingQualityScore,
      concisenessScore,
      overallScore,
    };
  }
}
