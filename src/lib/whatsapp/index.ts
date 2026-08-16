import { whatsappClient, type WhatsAppClientStatus } from "./client";
import { fallbackClient } from "./fallbackClient";
import { messageQueue } from "./queue";
import { logger } from "./logger";

export interface WhatsAppFullStatus extends WhatsAppClientStatus {
  queueLength: number;
}

class WhatsAppService {
  constructor() {
    // Autostart client on startup / server load only for the primary cluster instance.
    // Under PM2 cluster mode (instances: "max"), only instance 0 initializes the Baileys
    // socket to avoid on-disk auth credential races and continuous QR generation loops.
    const isBuilding =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build";

    if (typeof window === "undefined" && process.env.NODE_ENV !== "test" && !isBuilding) {
      const isMainInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";
      if (isMainInstance && process.env.WHATSAPP_AUTOSTART !== "false") {
        void this.initAutoStart();
      }
    }
  }

  private async initAutoStart(): Promise<void> {
    try {
      await whatsappClient.initialize();
      if (fallbackClient.hasSavedSession()) {
        await fallbackClient.initialize();
      }
    } catch (err: any) {
      logger.error("Auto-start initialization error", { error: err.message });
    }
  }

  /**
   * Enqueues a standard text message for sending via WhatsApp.
   */
  public async sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    return await messageQueue.enqueueMessage(phone, message);
  }

  /**
   * Enqueues an OTP verification code for sending via WhatsApp.
   */
  public async sendOTP(phone: string, otp: string, customTemplate?: string): Promise<{ success: boolean; messageId?: string }> {
    return await messageQueue.enqueueOTP(phone, otp, customTemplate);
  }

  /**
   * Retrieves current connection status, QR code data URL, and queue metrics.
   */
  public getStatus(): WhatsAppFullStatus {
    const clientStatus = whatsappClient.getStatus();
    return {
      ...clientStatus,
      queueLength: messageQueue.getQueueLength(),
    };
  }

  /**
   * Disconnects current WhatsApp session and wipes local auth credentials.
   */
  public async logout(): Promise<void> {
    await whatsappClient.logout();
  }

  /**
   * Force re-establishes connection to WhatsApp socket.
   */
  public async reconnect(): Promise<void> {
    await whatsappClient.forceReconnect();
  }
}

// Export singleton instance
export const whatsapp = new WhatsAppService();
export default whatsapp;
