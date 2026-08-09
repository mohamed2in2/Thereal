import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { reconnectManager } from "./reconnect";
import { logger } from "./logger";

export type FallbackConnectionState = "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED";

const FALLBACK_AUTH_DIR = path.join(process.cwd(), "whatsapp-auth-fallback");

function ensureFallbackAuthDir(): void {
  try {
    if (!fs.existsSync(FALLBACK_AUTH_DIR)) {
      fs.mkdirSync(FALLBACK_AUTH_DIR, { recursive: true });
    }
  } catch (err) {
    logger.error("Failed to create fallback auth directory", { error: String(err) });
  }
}

async function getFallbackAuthState() {
  ensureFallbackAuthDir();
  return await useMultiFileAuthState(FALLBACK_AUTH_DIR);
}

async function clearFallbackAuthState(): Promise<void> {
  try {
    if (fs.existsSync(FALLBACK_AUTH_DIR)) {
      fs.rmSync(FALLBACK_AUTH_DIR, { recursive: true, force: true });
      logger.info("Cleared fallback WhatsApp auth state", { dir: FALLBACK_AUTH_DIR });
    }
  } catch (err) {
    logger.error("Failed to clear fallback auth state", { error: String(err) });
  }
}

class FallbackWhatsAppClient {
  private socket: WASocket | null = null;
  private state: FallbackConnectionState = "DISCONNECTED";
  private rawQrCode: string | null = null;
  private qrCodeDataUrl: string | null = null;
  private connectedUser: { jid: string; name?: string; phone?: string } | null = null;
  private connectedAtTime: number | null = null;
  private isInitializing: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private qrAttempts: number = 0;

  public async initialize(): Promise<void> {
    if (this.socket || this.isInitializing) return;
    this.isInitializing = true;
    this.state = "CONNECTING";
    logger.info("Initializing Fallback WhatsApp Baileys client");

    try {
      const { state: authState, saveCreds } = await getFallbackAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1017531206] as [number, number, number] }));

      const pinoLogger = pino({ level: "silent" });

      this.socket = makeWASocket({
        version,
        auth: authState,
        printQRInTerminal: false,
        logger: pinoLogger,
        browser: ["Code-UP Fallback", "Chrome", "1.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 15000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 250,
      });

      this.socket.ev.on("creds.update", async () => {
        await saveCreds();
      });

      this.socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        await this.handleConnectionUpdate(update);
      });
    } catch (err: any) {
      this.isInitializing = false;
      this.state = "DISCONNECTED";
      logger.error("Failed to initialize fallback WhatsApp socket", { error: err.message });
    } finally {
      this.isInitializing = false;
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.rawQrCode = qr;
      this.state = "PAIRING";
      this.qrAttempts++;
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        logger.info("Fallback WhatsApp QR code generated", { attempt: this.qrAttempts });
      } catch (qrErr: any) {
        logger.error("Failed to generate fallback QR code", { error: qrErr.message });
      }
    }

    if (connection === "connecting") {
      if (this.state !== "PAIRING") {
        this.state = "CONNECTING";
      }
    }

    if (connection === "open") {
      this.state = "CONNECTED";
      this.rawQrCode = null;
      this.qrCodeDataUrl = null;
      this.connectedAtTime = Date.now();
      this.qrAttempts = 0;

      const user = this.socket?.user;
      if (user) {
        const phone = user.id ? user.id.split(":")[0].split("@")[0] : "";
        this.connectedUser = {
          jid: user.id,
          name: user.name || "Code-UP Fallback",
          phone: phone ? `+${phone}` : undefined,
        };
      }

      logger.info("Fallback WhatsApp connected", { user: this.connectedUser });
    }

    if (connection === "close") {
      this.state = "DISCONNECTED";
      this.connectedUser = null;
      this.connectedAtTime = null;
      this.socket = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        await clearFallbackAuthState();
        this.rawQrCode = null;
        this.qrCodeDataUrl = null;
        this.qrAttempts = 0;
      }
    }
  }

  public getSocket(): WASocket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return this.state === "CONNECTED" && !!this.socket;
  }

  public getState(): FallbackConnectionState {
    return this.state;
  }

  public getConnectedUser(): string | null {
    return this.connectedUser?.phone || this.connectedUser?.name || null;
  }

  public getStatus() {
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
    logger.info("Logging out fallback WhatsApp session");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        await this.socket.logout();
      } catch {}
      this.socket = null;
    }

    await clearFallbackAuthState();
    this.state = "DISCONNECTED";
    this.connectedUser = null;
    this.connectedAtTime = null;
    this.rawQrCode = null;
    this.qrCodeDataUrl = null;
    this.qrAttempts = 0;
  }

  public async forceReconnect(): Promise<void> {
    logger.info("Force reconnecting fallback WhatsApp socket");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.end(new Error("Force reconnecting fallback"));
      } catch {}
      this.socket = null;
    }

    await clearFallbackAuthState();
    this.state = "DISCONNECTED";
    this.connectedUser = null;
    this.connectedAtTime = null;
    this.rawQrCode = null;
    this.qrCodeDataUrl = null;
    this.qrAttempts = 0;
    this.isInitializing = false;

    await new Promise((r) => setTimeout(r, 500));
    await this.initialize();
  }

  public hasSavedSession(): boolean {
    try {
      return fs.existsSync(path.join(FALLBACK_AUTH_DIR, "creds.json"));
    } catch {
      return false;
    }
  }
}

export const fallbackClient = new FallbackWhatsAppClient();
