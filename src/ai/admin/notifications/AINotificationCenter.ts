export type SuperadminNotificationType =
  | "ProviderOffline"
  | "HighCost"
  | "JailbreakAttempt"
  | "HighErrorRate"
  | "BudgetExceeded"
  | "RateLimitExceeded";

export interface SuperadminNotification {
  id: string;
  type: SuperadminNotificationType;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: Date;
  read: boolean;
}

export class AINotificationCenter {
  private static instance: AINotificationCenter;
  private notifications: SuperadminNotification[] = [];

  public static getInstance(): AINotificationCenter {
    if (!AINotificationCenter.instance) {
      AINotificationCenter.instance = new AINotificationCenter();
    }
    return AINotificationCenter.instance;
  }

  public notify(type: SuperadminNotificationType, title: string, message: string, severity: "info" | "warning" | "critical" = "warning"): SuperadminNotification {
    const notif: SuperadminNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      severity,
      timestamp: new Date(),
      read: false,
    };

    this.notifications.push(notif);
    if (this.notifications.length > 500) this.notifications.shift();

    return notif;
  }

  public getNotifications(unreadOnly = false): SuperadminNotification[] {
    if (unreadOnly) {
      return this.notifications.filter((n) => !n.read);
    }
    return [...this.notifications];
  }
}
