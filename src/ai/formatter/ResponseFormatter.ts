import { FormattedResponse, ResponseFormatType } from "../types";

export class ResponseFormatter {
  public format(rawContent: string, preferredFormat: ResponseFormatType = "markdown"): FormattedResponse {
    let renderedContent = rawContent;
    let structuredData: Record<string, unknown> | undefined;

    switch (preferredFormat) {
      case "bullets":
        renderedContent = this.ensureBullets(rawContent);
        break;
      case "tables":
        renderedContent = this.ensureTableFormat(rawContent);
        break;
      case "flashcards":
        structuredData = this.extractFlashcardsData(rawContent);
        renderedContent = this.formatFlashcardsMarkdown(rawContent);
        break;
      case "quiz_cards":
        structuredData = this.extractQuizCardsData(rawContent);
        renderedContent = this.formatQuizMarkdown(rawContent);
        break;
      case "study_plan":
        renderedContent = this.formatStudyPlanMarkdown(rawContent);
        break;
      case "summary":
        renderedContent = this.ensureSummaryFormat(rawContent);
        break;
      case "equations":
        renderedContent = this.ensureEquationsFormat(rawContent);
        break;
      case "explanation":
      case "example":
      case "markdown":
      default:
        renderedContent = rawContent;
        break;
    }

    return {
      rawContent,
      formatType: preferredFormat,
      renderedContent,
      structuredData,
    };
  }

  private ensureBullets(text: string): string {
    if (text.includes("- ") || text.includes("* ") || text.includes("1. ")) {
      return text;
    }
    const lines = text.split("\n").filter((l) => l.trim());
    return lines.map((l) => `- ${l}`).join("\n");
  }

  private ensureTableFormat(text: string): string {
    if (text.includes("|")) return text;
    return (
      `| المفهوم / النقطة | التفاصيل والعناصر |\n` +
      `| --- | --- |\n` +
      `| النقاط الرئيسية | ${text.replace(/\n/g, "<br/>")} |`
    );
  }

  private extractFlashcardsData(text: string): Record<string, unknown> {
    const cards: Array<{ front: string; back: string }> = [];
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.includes("|") && !line.includes("---")) {
        const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2 && parts[0] !== "الوجه الأول (المفهوم)") {
          cards.push({ front: parts[0], back: parts[1] });
        }
      }
    }

    return { cardsCount: cards.length, cards };
  }

  private formatFlashcardsMarkdown(text: string): string {
    if (text.includes("Flashcards") || text.includes("|")) return text;
    return `### بطاقات الاستذكار السريع (Flashcards)\n\n${this.ensureTableFormat(text)}`;
  }

  private extractQuizCardsData(text: string): Record<string, unknown> {
    const questionsCount = (text.match(/سؤال/g) || []).length || 1;
    return { questionsCount, isInteractive: true };
  }

  private formatQuizMarkdown(text: string): string {
    return text.includes("بطاقة") ? text : `### بطاقات كويز تفاعلي\n\n${text}`;
  }

  private formatStudyPlanMarkdown(text: string): string {
    return text.includes("جدول") ? text : `### خطة الدراسة الشخصية\n\n${text}`;
  }

  private ensureSummaryFormat(text: string): string {
    return text.includes("ملخص") ? text : `### ملخص الدرس الأكاديمي\n\n${text}`;
  }

  private ensureEquationsFormat(text: string): string {
    return text;
  }
}
