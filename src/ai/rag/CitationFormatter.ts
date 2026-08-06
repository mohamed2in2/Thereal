import { SearchHit } from "./RetrievalIndex";

export class CitationFormatter {
  public static formatCitations(hits: SearchHit[]): string {
    if (hits.length === 0) return "";

    const citations = hits.map((hit, index) => {
      return `[ المصدر ${index + 1}: ${hit.document.title} (${hit.document.sourceType}) ]`;
    });

    return `\n\n--- المصادر والأدلة التعليمية المستند إليها ---\n` + citations.join("\n");
  }
}
