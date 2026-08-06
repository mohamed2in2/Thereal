export type MaintenanceStatus = "Normal" | "ReadOnly" | "LimitedAI" | "EmergencyShutdown";

export class MaintenanceMode {
  private static instance: MaintenanceMode;
  private status: MaintenanceStatus = "Normal";
  private maintenanceMessage = "نظام الذكاء الاصطناعي يخضع حالياً للصيانة المبرمجة.";

  public static getInstance(): MaintenanceMode {
    if (!MaintenanceMode.instance) {
      MaintenanceMode.instance = new MaintenanceMode();
    }
    return MaintenanceMode.instance;
  }

  public getStatus(): MaintenanceStatus {
    return this.status;
  }

  public setStatus(status: MaintenanceStatus): void {
    this.status = status;
  }

  public getMessage(): string {
    return this.maintenanceMessage;
  }
}
