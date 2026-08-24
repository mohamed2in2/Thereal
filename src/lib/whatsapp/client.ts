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
import { circuitBreaker } from "./circuitBreaker";

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

  private qrAttempts: number = 0;
  private static readonly MAX_QR_ATTEMPTS = 3; // After 3 QR cycles with no scan, clear auth and regenerate

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
        connectTimeoutMs: 15000,
        // Keep the socket's own pairing window aligned with MAX_QR_ATTEMPTS
        // (3 codes at ~20s each) so the two cannot expire out of step.
        qrTimeout: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 250,
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
      circuitBreaker.recordFailure(err);
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
      this.qrAttempts++;
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        logger.info("New WhatsApp pairing QR code generated", { attempt: this.qrAttempts });
      } catch (qrErr: any) {
        logger.error("Failed to generate QR code Data URL", { error: qrErr.message });
      }

      // If we've shown too many QR codes without a successful scan, clear auth
      // and start fresh so stale session data doesn't block pairing.
      //
      // This previously only reset the counter, so the recovery the comment
      // describes never actually ran and a half-written auth folder could keep
      // rejecting every scan indefinitely.
      if (this.qrAttempts >= WhatsAppClientManager.MAX_QR_ATTEMPTS) {
        logger.warn("QR code expired after max attempts, clearing auth for fresh pairing", { attempts: this.qrAttempts });
        this.qrAttempts = 0;
        this.rawQrCode = null;
        this.qrCodeDataUrl = null;
        try {
          await clearAuthState();
        } catch (clearErr) {
          logger.error("Failed to clear auth state for fresh pairing", {
            error: clearErr instanceof Error ? clearErr.message : String(clearErr),
          });
        }
        try {
          this.socket?.end(undefined);
        } catch {
          /* socket may already be torn down */
        }
        this.socket = null;
        this.state = "DISCONNECTED";
        this.isInitializing = false;
        logger.info("QR code expired after max attempts; paused until manual reconnection from admin panel");
        return;
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
      this.qrAttempts = 0;
      reconnectManager.resetReconnectAttempts();
      circuitBreaker.recordSuccess();

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

      // A QR is only valid for the socket that issued it. Clearing it here — not
      // just on logout — is the actual fix for "the QR shows but scanning does
      // nothing": once Baileys timed the pairing out, the admin panel kept
      // rendering the last QR from the dead socket, so every scan was against a
      // code WhatsApp had already discarded.
      this.rawQrCode = null;
      this.qrCodeDataUrl = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isForbidden = statusCode === 403 || statusCode === 405;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut && !isForbidden;

      logger.warn("WhatsApp connection closed", { statusCode, shouldReconnect });

      if (isForbidden) {
        circuitBreaker.recordFailure(lastDisconnect?.error || new Error("Account restricted (403)"), 403);
        logger.error("WhatsApp account restricted or forbidden by WhatsApp server. Reconnect aborted.");
        return;
      }

      if (isLoggedOut) {
        circuitBreaker.recordFailure(new Error("Session logged out"), 401);
        logger.warn("WhatsApp session logged out. Clearing authentication state.");
        await clearAuthState();
        this.rawQrCode = null;
        this.qrCodeDataUrl = null;
        this.qrAttempts = 0;
        setTimeout(() => void this.initialize(), 1500);
      } else {
        circuitBreaker.recordFailure(lastDisconnect?.error, statusCode);
        if (shouldReconnect && circuitBreaker.getState() !== "ACCOUNT_RESTRICTED") {
          this.scheduleReconnect();
        }
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

  public getState(): WhatsAppConnectionState {
    return this.state;
  }

  public getConnectedUser(): string | null {
    return this.connectedUser?.phone || this.connectedUser?.name || null;
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
    this.qrAttempts = 0;

    // Immediately re-initialize to generate a fresh QR code
    setTimeout(() => void this.initialize(), 1000);
  }

  public async reconnect(): Promise<void> {
    return this.forceReconnect();
  }

  /**
   * Force reconnect: clears stale auth, kills current socket,
   * and re-initializes from scratch to generate a fresh QR code.
   */
  public async forceReconnect(): Promise<void> {
    logger.info("Force reconnecting WhatsApp socket (clearing auth for fresh QR)");
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

    // Clear stale auth state so we get a brand new QR code
    await clearAuthState();

    this.state = "DISCONNECTED";
    this.connectedUser = null;
    this.connectedAtTime = null;
    this.rawQrCode = null;
    this.qrCodeDataUrl = null;
    this.qrAttempts = 0;
    this.isInitializing = false;
    reconnectManager.resetReconnectAttempts();

    // Small delay to ensure cleanup completes before re-init
    await new Promise((r) => setTimeout(r, 500));
    await this.initialize();
  }
}

export const whatsappClient = new WhatsAppClientManager();
