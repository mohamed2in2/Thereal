export interface PromptVersion {
  version: number;
  promptKey: string;
  content: string;
  updatedBy: string;
  createdAt: Date;
  changeReason?: string;
}

export class PromptLibrary {
  private static instance: PromptLibrary;
  private versionHistory: Map<string, PromptVersion[]> = new Map();
  private activeVersions: Map<string, number> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): PromptLibrary {
    if (!PromptLibrary.instance) {
      PromptLibrary.instance = new PromptLibrary();
    }
    return PromptLibrary.instance;
  }

  private seedDefaults(): void {
    this.createPromptVersion("identity", "أنت المحرك الذكي التفاعلي لمنصة Code-UP والتعليم المصري.", "system", "Initial default prompt");
    this.createPromptVersion("safety", "تجنب تماماً إعطاء محتوى غير فصيح أو غير آمن أو معلومات غير مفحوصة.", "system", "Initial safety prompt");
  }

  public createPromptVersion(
    promptKey: string,
    content: string,
    updatedBy: string,
    changeReason?: string
  ): PromptVersion {
    const history = this.versionHistory.get(promptKey) || [];
    const newVersionNum = history.length + 1;

    const newVersion: PromptVersion = {
      version: newVersionNum,
      promptKey,
      content,
      updatedBy,
      createdAt: new Date(),
      changeReason,
    };

    history.push(newVersion);
    this.versionHistory.set(promptKey, history);
    this.activeVersions.set(promptKey, newVersionNum);

    return newVersion;
  }

  public getActivePrompt(promptKey: string): string {
    const history = this.versionHistory.get(promptKey);
    if (!history || history.length === 0) return "";

    const activeVerNum = this.activeVersions.get(promptKey) || history.length;
    const found = history.find((v) => v.version === activeVerNum);
    return found ? found.content : history[history.length - 1].content;
  }

  public rollbackToVersion(promptKey: string, targetVersion: number): boolean {
    const history = this.versionHistory.get(promptKey);
    if (!history) return false;

    const exists = history.some((v) => v.version === targetVersion);
    if (exists) {
      this.activeVersions.set(promptKey, targetVersion);
      return true;
    }

    return false;
  }

  public getVersionHistory(promptKey: string): PromptVersion[] {
    return this.versionHistory.get(promptKey) || [];
  }
}
