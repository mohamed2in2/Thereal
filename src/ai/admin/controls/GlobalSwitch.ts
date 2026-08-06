export class GlobalSwitch {
  private static instance: GlobalSwitch;
  private aiEnabled = process.env.AI_GLOBAL_ENABLED !== "false";
  private disabledMessage = "AI service is currently unavailable.";

  public static getInstance(): GlobalSwitch {
    if (!GlobalSwitch.instance) {
      GlobalSwitch.instance = new GlobalSwitch();
    }
    return GlobalSwitch.instance;
  }

  public isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  public setAIEnabled(enabled: boolean): void {
    this.aiEnabled = enabled;
  }

  public getDisabledMessage(): string {
    return this.disabledMessage;
  }

  public setDisabledMessage(msg: string): void {
    this.disabledMessage = msg;
  }
}
