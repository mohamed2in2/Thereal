import { ContextBuilder } from "../../context/ContextBuilder";
import { PromptBuilder } from "../../prompts/PromptBuilder";
import { ProviderManager } from "../../providers/ProviderManager";
import { EducationalActionType } from "../../types";

export interface SandboxTestOptions {
  userMessage: string;
  action: EducationalActionType;
  subject: string;
  grade: string;
  providerId?: string;
}

export interface SandboxTestResult {
  finalPromptText: string;
  estimatedInputTokens: number;
  simulatedOutputText: string;
  providerUsed: string;
  executionTimeMs: number;
}

export class PromptSandbox {
  private contextBuilder: ContextBuilder;
  private promptBuilder: PromptBuilder;
  private providerManager: ProviderManager;

  constructor() {
    this.contextBuilder = new ContextBuilder();
    this.promptBuilder = new PromptBuilder();
    this.providerManager = new ProviderManager();
  }

  public async runTest(options: SandboxTestOptions): Promise<SandboxTestResult> {
    const startTime = Date.now();

    const context = this.contextBuilder.buildContext({
      subject: options.subject,
      grade: options.grade,
      action: options.action,
    });

    const finalPrompt = this.promptBuilder.buildPrompt({
      userMessage: options.userMessage,
      context,
      actionInstructions: `[SANDBOX TEST INSTRUCTION for ${options.action}]`,
      subjectRules: `[SANDBOX SUBJECT RULES for ${options.subject}]`,
    });

    const provider = this.providerManager.getProvider(options.providerId || "mock");
    const estimatedInputTokens = provider.estimateTokens(finalPrompt.fullPrompt);

    const genRes = await provider.generate({
      prompt: finalPrompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    return {
      finalPromptText: finalPrompt.fullPrompt,
      estimatedInputTokens,
      simulatedOutputText: genRes.text,
      providerUsed: provider.name,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
