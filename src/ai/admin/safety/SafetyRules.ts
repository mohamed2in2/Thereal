export interface AISafetyConfig {
  maxPromptTokens: number;
  maxOutputTokens: number;
  maxToolCallsPerRequest: number;
  maxRetries: number;
  maxContextSizeBytes: number;
  maxUploadSizeBytes: number;
  maxOCRPages: number;
  maxPDFPages: number;
}

export class SafetyRules {
  private static instance: SafetyRules;
  private config: AISafetyConfig = {
    maxPromptTokens: 4000,
    maxOutputTokens: 2048,
    maxToolCallsPerRequest: 5,
    maxRetries: 1,
    maxContextSizeBytes: 1024 * 1024, // 1MB
    maxUploadSizeBytes: 10 * 1024 * 1024, // 10MB
    maxOCRPages: 10,
    maxPDFPages: 50,
  };

  public static getInstance(): SafetyRules {
    if (!SafetyRules.instance) {
      SafetyRules.instance = new SafetyRules();
    }
    return SafetyRules.instance;
  }

  public getConfig(): AISafetyConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AISafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
