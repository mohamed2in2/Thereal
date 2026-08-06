import { WhatsAppProvider, ProviderId, SendMessageParams, SendResult, ProviderHealth, ProviderStatus } from "./providerInterface";

class OfficialMetaProvider implements WhatsAppProvider {
  public id: ProviderId = "OFFICIAL_API";
  public name: string = "Official Meta WhatsApp Business API";

  private lastSuccessfulSend: string | null = null;
  private lastFailedSend: string | null = null;
  private latencySamples: number[] = [];

  private getConfig() {
    return {
      token: process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || "",
      phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      businessName: process.env.META_BUSINESS_NAME || "Code-UP Official",
      apiBaseUrl: "https://graph.facebook.com/v18.0",
    };
  }

  public async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const startTime = Date.now();
    const config = this.getConfig();

    if (!config.token || !config.phoneNumberId) {
      const err = "Meta WhatsApp Business API credentials not configured in process.env";
      this.lastFailedSend = new Date().toISOString();
      return {
        success: false,
        provider: this.id,
        error: err,
      };
    }

    try {
      // Format E.164 phone: remove + and spaces
      const cleanPhone = params.recipient.replace(/[^\d]/g, "");

      let payload: any;

      if (params.templateName) {
        // Send Meta Template message
        payload = {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: "ar" },
            components: params.templateVariables ? [
              {
                type: "body",
                parameters: Object.values(params.templateVariables).map(val => ({
                  type: "text",
                  text: val
                }))
              }
            ] : undefined
          }
        };
      } else {
        // Send Standard Text message
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: params.content }
        };
      }

      const response = await fetch(`${config.apiBaseUrl}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const latency = Date.now() - startTime;
      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        this.lastFailedSend = new Date().toISOString();
        return {
          success: false,
          provider: this.id,
          deliveryTimeMs: latency,
          error: errorMsg,
        };
      }

      this.recordLatency(latency);
      this.lastSuccessfulSend = new Date().toISOString();

      const messageId = responseData?.messages?.[0]?.id || `meta-${Date.now()}`;

      return {
        success: true,
        provider: this.id,
        messageId,
        deliveryTimeMs: latency,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      this.lastFailedSend = new Date().toISOString();
      return {
        success: false,
        provider: this.id,
        deliveryTimeMs: latency,
        error: err?.message || "Failed to reach Meta WhatsApp API endpoint",
      };
    }
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const config = this.getConfig();
    const isConfigured = Boolean(config.token && config.phoneNumberId);

    return {
      online: isConfigured,
      lastSuccessfulSend: this.lastSuccessfulSend,
      lastFailedSend: this.lastFailedSend,
      queueDepth: 0,
      avgResponseLatencyMs: this.getAverageLatency(),
      details: {
        phoneNumberId: config.phoneNumberId || "Not Set",
        businessName: config.businessName,
        hasToken: Boolean(config.token),
      },
    };
  }

  public getStatus(): ProviderStatus {
    const config = this.getConfig();
    const isConfigured = Boolean(config.token && config.phoneNumberId);

    return {
      id: this.id,
      name: this.name,
      connected: isConfigured,
      statusText: isConfigured
        ? `🟢 Configured (${config.businessName})`
        : `🔴 Pending Credentials (.env)`,
      health: {
        online: isConfigured,
        lastSuccessfulSend: this.lastSuccessfulSend,
        lastFailedSend: this.lastFailedSend,
        queueDepth: 0,
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
    if (this.latencySamples.length === 0) return 240;
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencySamples.length);
  }
}

export const officialMetaProvider = new OfficialMetaProvider();
