import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { getAuthState, clearAuthState } from "./auth";
import { reconnectManager } from "./reconnect";
import { logger } from "./logger";

export type WhatsAppConnectionState = "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED";

export interface WhatsAppClientStatus {
  connected: boolean;
  state: WhatsAppConnectionState;
  user: { jid: string; name?: string; phone?: string } | null;
  qrCodeDataUrl: string | null;
  uptimeSeconds: number;
  connectedAt: string | null;
}

class WhatsAppClientManager {
  private socket: WASocket | null = null;
  private state: WhatsAppConnectionState = "DISCONNECTED";
  private rawQrCode: string | null = null;
  private qrCodeDataUrl: string | null = null;
  private connectedUser: { jid: string; name?: string; phone?: string } | null = null;
  private connectedAtTime: number | null = null;
  private isInitializing: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  public async initialize(): Promise<void> {
    if (this.socket || this.isInitializing) return;
    this.isInitializing = true;
    this.state = "CONNECTING";
    logger.info("Initializing WhatsApp Baileys client service");

    try {
      const { state: authState, saveCreds } = await getAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1017531206] as [number, number, number] }));

      // Silent pino logger for internal Baileys events to prevent cluttering console
      const pinoLogger = pino({ level: "silent" });

      this.socket = makeWASocket({
        version,
        auth: authState,
        printQRInTerminal: false,
        logger: pinoLogger,
        browser: ["Code-UP Platform", "Chrome", "1.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
      });

      // Save credentials whenever updated
      this.socket.ev.on("creds.update", async () => {
        await saveCreds();
      });

      // Handle connection updates
      this.socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        await this.handleConnectionUpdate(update);
      });
    } catch (err: any) {
      this.isInitializing = false;
      this.state = "DISCONNECTED";
      logger.error("Failed to initialize WhatsApp socket", { error: err.message });
      this.scheduleReconnect();
    } finally {
      this.isInitializing = false;
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    // Handle QR code generation
    if (qr) {
      this.rawQrCode = qr;
      this.state = "PAIRING";
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        logger.info("New WhatsApp pairing QR code generated");
      } catch (qrErr: any) {
        logger.error("Failed to generate QR code Data URL", { error: qrErr.message });
      }
    }

    if (connection === "connecting") {
      if (this.state !== "PAIRING") {
        this.state = "CONNECTING";
      }
      logger.info("WhatsApp connection status: connecting");
    }

    if (connection === "open") {
      this.state = "CONNECTED";
      this.rawQrCode = null;
      this.qrCodeDataUrl = null;
      this.connectedAtTime = Date.now();
      reconnectManager.resetReconnectAttempts();

      const user = this.socket?.user;
      if (user) {
        const phone = user.id ? user.id.split(":")[0].split("@")[0] : "";
        this.connectedUser = {
          jid: user.id,
          name: user.name || "Code-UP Bot",
          phone: phone ? `+${phone}` : undefined,
        };
      }

      logger.info("WhatsApp connected successfully", { user: this.connectedUser });
    }

    if (connection === "close") {
      this.state = "DISCONNECTED";
      this.connectedUser = null;
      this.connectedAtTime = null;
      this.socket = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn("WhatsApp connection closed", { statusCode, shouldReconnect });

      if (statusCode === DisconnectReason.loggedOut) {
        logger.warn("WhatsApp session logged out. Clearing authentication state.");
        await clearAuthState();
        this.rawQrCode = null;
        this.qrCodeDataUrl = null;
      } else if (shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const delay = reconnectManager.getNextReconnectDelay();
    if (delay !== null) {
      logger.info("Scheduling WhatsApp reconnect timer", { delayMs: delay });
      this.reconnectTimer = setTimeout(() => {
        void this.initialize();
      }, delay);
    }
  }

  public getSocket(): WASocket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return this.state === "CONNECTED" && !!this.socket;
  }

  public getStatus(): WhatsAppClientStatus {
    const uptimeSeconds = this.connectedAtTime ? Math.floor((Date.now() - this.connectedAtTime) / 1000) : 0;
    return {
      connected: this.isConnected(),
      state: this.state,
      user: this.connectedUser,
      qrCodeDataUrl: this.qrCodeDataUrl,
      uptimeSeconds,
      connectedAt: this.connectedAtTime ? new Date(this.connectedAtTime).toISOString() : null,
    };
  }

  public async logout(): Promise<void> {
    logger.info("Logging out WhatsApp session via user action");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (err: any) {
        logger.error("Error during socket logout", { error: err.message });
      }
      this.socket = null;
    }

    await clearAuthState();
    this.state = "DISCONNECTED";
    this.connectedUser = null;
    this.connectedAtTime = null;
    this.rawQrCode = null;
    this.qrCodeDataUrl = null;
  }

  public async reconnect(): Promise<void> {
    return this.forceReconnect();
  }

  public async forceReconnect(): Promise<void> {
    logger.info("Force reconnecting WhatsApp socket");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.end(new Error("Force reconnecting"));
      } catch {}
      this.socket = null;
    }

    this.state = "DISCONNECTED";
    reconnectManager.resetReconnectAttempts();
    await this.initialize();
  }
}

export const whatsappClient = new WhatsAppClientManager();
