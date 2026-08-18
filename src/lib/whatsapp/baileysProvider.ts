import { WhatsAppProvider, ProviderId, SendMessageParams, SendResult, ProviderHealth, ProviderStatus } from "./providerInterface";
import { whatsappClient } from "./client";
import { fallbackClient } from "./fallbackClient";
import { messageQueue, PriorityBand, JobCategory } from "./queue";
import { sendRawWhatsAppMessage as sendViaBaileys } from "./sender";
import { logger } from "./logger";
import { circuitBreaker } from "./circuitBreaker";

class BaileysProvider implements WhatsAppProvider {
  public id: ProviderId = "BAILEYS";
  public name: string = "Baileys WhatsApp Engine";

  private lastSuccessfulSend: string | null = null;
  private lastFailedSend: string | null = null;
  private latencySamples: number[] = [];

  public async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const startTime = Date.now();
    const isOtp = params.messageType === "OTP";
    const priority: PriorityBand = isOtp ? "P0" : params.messageType === "ANNOUNCEMENT" ? "P3" : "P2";
    const category: JobCategory = isOtp ? "OTP" : params.messageType === "PARENT_LINK" ? "PARENT_LINK" : "NOTIFICATION";

    try {
      // 1. If Baileys is available and healthy, dispatch via multi-band priority queue
      if (circuitBreaker.isBaileysAvailable() && whatsappClient.isConnected()) {
        const result = await messageQueue.enqueueJob({
          recipient: params.recipient,
          content: params.content,
          priority,
          category,
          expiresInSeconds: isOtp ? 300 : 1800,
          fallbackPolicy: isOtp ? "META" : "NONE",
        });

        const latency = Date.now() - startTime;
        this.recordLatency(latency);
        this.lastSuccessfulSend = new Date().toISOString();

        return {
          success: result.success,
          provider: (result.provider as ProviderId) || this.id,
          messageId: result.messageId || `baileys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          deliveryTimeMs: latency,
          error: result.error,
        };
      }

      // 2. If primary Baileys is degraded/disconnected but fallback Baileys number is connected
      if (fallbackClient.isConnected() && circuitBreaker.getState() !== "ACCOUNT_RESTRICTED") {
        logger.info("Primary Baileys unavailable, attempting fallback secondary Baileys socket", {
          recipient: params.recipient,
          messageType: params.messageType,
        });

        const fbSocket = fallbackClient.getSocket();
        if (fbSocket) {
          const phone = params.recipient.replace(/[^\d]/g, "");
          const jid = `${phone}@s.whatsapp.net`;

          await sendViaBaileys(fbSocket, jid, params.content);

          const latency = Date.now() - startTime;
          this.recordLatency(latency);
          this.lastSuccessfulSend = new Date().toISOString();

          return {
            success: true,
            provider: this.id,
            messageId: `baileys-fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            deliveryTimeMs: latency,
          };
        }
      }

      // 3. Fallback queue dispatch (which evaluates circuit breaker & Meta API fallback)
      const queueRes = await messageQueue.enqueueJob({
        recipient: params.recipient,
        content: params.content,
        priority,
        category,
        expiresInSeconds: isOtp ? 300 : 1800,
        fallbackPolicy: isOtp ? "META" : "NONE",
      });

      const latency = Date.now() - startTime;
      return {
        success: queueRes.success,
        provider: (queueRes.provider as ProviderId) || this.id,
        messageId: queueRes.messageId,
        deliveryTimeMs: latency,
        error: queueRes.error,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      this.lastFailedSend = new Date().toISOString();
      return {
        success: false,
        provider: this.id,
        deliveryTimeMs: latency,
        error: err?.message || "Failed to dispatch via Baileys engine",
      };
    }
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const isConn = whatsappClient.isConnected();
    const state = whatsappClient.getState();
    const circuitState = circuitBreaker.getState();
    const queueLen = messageQueue.getQueueLength();

    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    const avgLatency = this.latencySamples.length > 0 ? Math.round(sum / this.latencySamples.length) : 120;

    return {
      online: isConn && circuitBreaker.isBaileysAvailable(),
      lastSuccessfulSend: this.lastSuccessfulSend,
      lastFailedSend: this.lastFailedSend,
      queueDepth: queueLen,
      avgResponseLatencyMs: avgLatency,
      details: {
        connectionState: state,
        circuitBreakerState: circuitState,
        userJid: whatsappClient.getConnectedUser(),
        queueBreakdown: messageQueue.getQueueLengthsByBand(),
      },
    };
  }

  public getStatus(): ProviderStatus {
    const isConn = whatsappClient.isConnected();
    const state = whatsappClient.getState();
    const user = whatsappClient.getConnectedUser();
    const clientStatus = whatsappClient.getStatus();
    const circuitState = circuitBreaker.getState();

    let statusText = `🔴 Disconnected (${state})`;
    if (circuitState === "ACCOUNT_RESTRICTED") {
      statusText = "⛔ WhatsApp Account Restricted (403 Forbidden — Baileys disabled)";
    } else if (circuitState === "SESSION_INVALID") {
      statusText = "🔑 WhatsApp Session Expired (Scan QR code to re-authenticate)";
    } else if (circuitState === "PROVIDER_UNHEALTHY") {
      statusText = "⚠️ Connection Degraded (Reconnecting with backoff...)";
    } else if (isConn) {
      statusText = `🟢 Connected (${user || "Paired"})`;
    } else if (state === "PAIRING") {
      statusText = "📱 QR Code Ready — Scan to pair";
    } else if (state === "CONNECTING") {
      statusText = "⏳ Connecting...";
    }

    return {
      id: this.id,
      name: this.name,
      connected: isConn && circuitBreaker.isBaileysAvailable(),
      statusText,
      qrCodeDataUrl: clientStatus.qrCodeDataUrl,
      state: state,
      user: clientStatus.user,
      health: {
        online: isConn && circuitBreaker.isBaileysAvailable(),
        lastSuccessfulSend: this.lastSuccessfulSend,
        lastFailedSend: this.lastFailedSend,
        queueDepth: messageQueue.getQueueLength(),
        avgResponseLatencyMs: this.getAverageLatency(),
        details: {
          circuitBreaker: circuitBreaker.getStatus(),
          queues: messageQueue.getQueueLengthsByBand(),
        },
      },
    };
  }

  private recordLatency(ms: number) {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > 20) {
      this.latencySamples.shift();
    }
  }

  private getAverageLatency(): number {
    if (this.latencySamples.length === 0) return 120;
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencySamples.length);
  }
}

export const baileysProvider = new BaileysProvider();

