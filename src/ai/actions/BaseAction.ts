import { AIContext, EducationalAction, EducationalActionType, ResponseFormatType } from "../types";

export abstract class BaseAction implements EducationalAction {
  public abstract type: EducationalActionType;
  public abstract name: string;
  public abstract description: string;

  public abstract getPromptInstructions(context: AIContext, params?: Record<string, unknown>): string;

  public validateParams(params?: Record<string, unknown>): boolean {
    // Default validation: optional object
    return true;
  }

  public getPreferredFormat(): ResponseFormatType {
    return "markdown";
  }

  protected formatHeader(title: string): string {
    return `[ACTION: ${this.type}]\n=== ${title.toUpperCase()} ===\n`;
  }
}
