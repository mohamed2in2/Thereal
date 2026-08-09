import { WhatsAppProvider, ProviderId, SendMessageParams, SendResult, ProviderHealth, ProviderStatus } from "./providerInterface";
import { whatsappClient } from "./client";
import { fallbackClient } from "./fallbackClient";
import { messageQueue } from "./queue";
import { sendRawWhatsAppMessage as sendViaBaileys } from "./sender";
import { logger } from "./logger";

class BaileysProvider implements WhatsAppProvider {
  public id: ProviderId = "BAILEYS";
  public name: string = "Baileys WhatsApp Engine";

  private lastSuccessfulSend: string | null = null;
  private lastFailedSend: string | null = null;
  private latencySamples: number[] = [];

  public async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const startTime = Date.now();
    try {
      // Try primary Baileys first
      if (whatsappClient.isConnected()) {
        const estimatedWaitMs = messageQueue.getEstimatedWaitTimeMs(params.messageType === "OTP");
        if (estimatedWaitMs <= 10000) {
          await messageQueue.enqueue(
            params.recipient,
            params.content,
            params.messageType === "OTP"
          );

          const latency = Date.now() - startTime;
          this.recordLatency(latency);
          this.lastSuccessfulSend = new Date().toISOString();

          return {
            success: true,
            provider: this.id,
            messageId: `baileys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            deliveryTimeMs: latency,
          };
        }
      }

      // Primary failed or disconnected — try fallback Baileys number
      if (fallbackClient.isConnected()) {
        logger.info("Primary Baileys unavailable, trying fallback number", {
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

      // Both primary and fallback unavailable
      const err = "Baileys primary and fallback numbers are both disconnected";
      this.lastFailedSend = new Date().toISOString();
      return {
        success: false,
        provider: this.id,
        deliveryTimeMs: Date.now() - startTime,
        error: err,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      this.lastFailedSend = new Date().toISOString();
      return {
        success: false,
        provider: this.id,
        deliveryTimeMs: latency,
        error: err?.message || "Failed to dispatch via Baileys socket",
      };
    }
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const isConn = whatsappClient.isConnected();
    const state = whatsappClient.getState();
    const queueLen = messageQueue.getQueueLength();

    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    const avgLatency = this.latencySamples.length > 0 ? Math.round(sum / this.latencySamples.length) : 120;

    return {
      online: isConn,
      lastSuccessfulSend: this.lastSuccessfulSend,
      lastFailedSend: this.lastFailedSend,
      queueDepth: queueLen,
      avgResponseLatencyMs: avgLatency,
      details: {
        connectionState: state,
        userJid: whatsappClient.getConnectedUser(),
      },
    };
  }

  public getStatus(): ProviderStatus {
    const isConn = whatsappClient.isConnected();
    const state = whatsappClient.getState();
    const user = whatsappClient.getConnectedUser();
    const clientStatus = whatsappClient.getStatus();

    const estWaitMs = messageQueue.getEstimatedWaitTimeMs();
    const waitSec = Math.round(estWaitMs / 1000);
    const queueWarn = estWaitMs > 10000 ? ` ⚠️ High Queue Delay (${waitSec}s > 10s -> Meta API)` : "";

    return {
      id: this.id,
      name: this.name,
      connected: isConn,
      statusText: isConn
        ? `🟢 Connected (${user || "Paired"})${queueWarn}`
        : state === "PAIRING"
        ? "📱 QR Code Ready — Scan to pair"
        : state === "CONNECTING"
        ? "⏳ Connecting..."
        : `🔴 Disconnected (${state})`,
      qrCodeDataUrl: clientStatus.qrCodeDataUrl,
      state: state,
      user: clientStatus.user,
      health: {
        online: isConn,
        lastSuccessfulSend: this.lastSuccessfulSend,
        lastFailedSend: this.lastFailedSend,
        queueDepth: messageQueue.getQueueLength(),
        avgResponseLatencyMs: this.getAverageLatency(),
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
