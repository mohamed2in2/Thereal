export type MessageType = "OTP" | "PARENT_LINK" | "NOTIFICATION" | "ANNOUNCEMENT" | "CUSTOM";

export type ProviderId = "BAILEYS" | "OFFICIAL_API";

export interface SendMessageParams {
  recipient: string; // E.164 format, e.g. +201012345678
  messageType: MessageType;
  content: string;
  templateName?: string;
  templateVariables?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  provider: ProviderId;
  messageId?: string;
  deliveryTimeMs?: number;
  error?: string;
}

export interface ProviderHealth {
  online: boolean;
  lastSuccessfulSend: string | null; // ISO string
  lastFailedSend: string | null;     // ISO string
  queueDepth: number;
  avgResponseLatencyMs: number;
  details?: Record<string, any>;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  connected: boolean;
  statusText: string;
  health: ProviderHealth;
}

export interface WhatsAppProvider {
  id: ProviderId;
  name: string;
  sendMessage(params: SendMessageParams): Promise<SendResult>;
  checkHealth(): Promise<ProviderHealth>;
  getStatus(): ProviderStatus;
}
