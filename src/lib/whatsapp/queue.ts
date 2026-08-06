import { whatsappClient } from "./client";
import { sendRawWhatsAppMessage } from "./sender";
import { rateLimiter } from "./rateLimiter";
import { normalizePhoneToJid, validateMessageContent, formatOTPMessage } from "./formatter";
import { logger } from "./logger";

export interface QueueItem {
  id: string;
  type: "TEXT" | "OTP";
  phoneE164: string;
  jid: string;
  content: string;
  otpCode?: string;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: number;
  resolve: (value: { success: boolean; messageId?: string; error?: string }) => void;
  reject: (reason: Error) => void;
}

class WhatsAppQueueManager {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private lastGlobalSendTime: number = 0;
  private lastOTPSendTime: number = 0;

  // Delays per requirements
  private GLOBAL_COOLDOWN_MS = 5000; // 5 seconds between any message
  private OTP_COOLDOWN_MS = 10000;   // 10 seconds between OTP messages

  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueues a standard text message.
   */
  public enqueueMessage(rawPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { phoneE164, jid } = normalizePhoneToJid(rawPhone);
    validateMessageContent(text);

    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "TEXT",
        phoneE164,
        jid,
        content: text,
        attempts: 0,
        maxAttempts: 3,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };

      this.queue.push(item);
      logger.info("Enqueued message into FIFO queue", {
        queueId: item.id,
        phone: phoneE164,
        queueSize: this.queue.length,
      });

      this.processNext();
    });
  }

  /**
   * Enqueues an OTP message with rate-limiting validation.
   */
  public enqueueOTP(rawPhone: string, otpCode: string, customTemplate?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { phoneE164, jid } = normalizePhoneToJid(rawPhone);
    
    // Check per-phone rate limits before enqueuing
    const limitCheck = rateLimiter.checkOTPRateLimit(phoneE164);
    if (!limitCheck.allowed) {
      logger.warn("OTP request blocked by rate limiter", { phone: phoneE164, reason: limitCheck.reason });
      return Promise.reject(new Error(limitCheck.reason || "OTP rate limit exceeded."));
    }

    const content = formatOTPMessage(otpCode, customTemplate);
    validateMessageContent(content);

    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: `otp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "OTP",
        phoneE164,
        jid,
        content,
        otpCode,
        attempts: 0,
        maxAttempts: 3,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };

      this.queue.push(item);
      logger.info("Enqueued OTP message into FIFO queue", {
        queueId: item.id,
        phone: phoneE164,
        queueSize: this.queue.length,
      });

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const item = this.queue[0];
    const now = Date.now();

    // 1. Calculate required delay for Global Cooldown (5 seconds)
    const timeSinceGlobal = now - this.lastGlobalSendTime;
    const globalWait = Math.max(0, this.GLOBAL_COOLDOWN_MS - timeSinceGlobal);

    // 2. Calculate additional delay if OTP Cooldown applies (10 seconds)
    let otpWait = 0;
    if (item.type === "OTP") {
      const timeSinceOTP = now - this.lastOTPSendTime;
      otpWait = Math.max(0, this.OTP_COOLDOWN_MS - timeSinceOTP);
    }

    const requiredWait = Math.max(globalWait, otpWait);

    if (requiredWait > 0) {
      logger.debug("Enforcing queue cooldown delay", {
        queueId: item.id,
        waitMs: requiredWait,
        type: item.type,
      });
      await new Promise((r) => setTimeout(r, requiredWait));
    }

    // Attempt to dispatch
    item.attempts++;
    try {
      if (!whatsappClient.isConnected()) {
        // Attempt to auto-initialize if client is disconnected
        await whatsappClient.initialize();
        if (!whatsappClient.isConnected()) {
          throw new Error("WhatsApp client is disconnected. Message held in queue.");
        }
      }

      const socket = whatsappClient.getSocket();
      await sendRawWhatsAppMessage(socket, item.jid, item.content);

      // Record send times
      const sentTime = Date.now();
      this.lastGlobalSendTime = sentTime;
      if (item.type === "OTP") {
        this.lastOTPSendTime = sentTime;
        rateLimiter.recordOTPSend(item.phoneE164);
      }

      logger.info("Successfully sent queued message", {
        queueId: item.id,
        phone: item.phoneE164,
        type: item.type,
        queueRemaining: this.queue.length - 1,
      });

      this.queue.shift(); // Remove from queue
      item.resolve({ success: true });
    } catch (err: any) {
      logger.error("Failed to send queued WhatsApp message", {
        queueId: item.id,
        phone: item.phoneE164,
        attempt: item.attempts,
        error: err.message,
      });

      if (item.attempts < item.maxAttempts && !err.message.includes("Invalid phone number")) {
        // Retry with exponential backoff delay before next attempt
        const retryDelay = 2000 * Math.pow(2, item.attempts - 1);
        logger.info("Scheduling retry for queued message", { queueId: item.id, retryDelayMs: retryDelay });
        await new Promise((r) => setTimeout(r, retryDelay));
      } else {
        // Max attempts reached or non-retryable error
        this.queue.shift();
        item.reject(err);
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

export const messageQueue = new WhatsAppQueueManager();
