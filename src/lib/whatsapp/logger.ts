import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "whatsapp.log");
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB rotation limit

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[WhatsAppLogger] Failed to create log directory:", err);
  }
}

function rotateLogIfNeeded(): void {
  try {
    ensureLogDir();
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        const rotatedFile = path.join(LOG_DIR, `whatsapp-${Date.now()}.log`);
        fs.renameSync(LOG_FILE, rotatedFile);
      }
    }
  } catch (err) {
    console.error("[WhatsAppLogger] Failed to rotate log file:", err);
  }
}

export type WhatsAppLogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export function writeWhatsAppLog(level: WhatsAppLogLevel, event: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  let detailStr = "";
  if (details && Object.keys(details).length > 0) {
    try {
      detailStr = " " + JSON.stringify(details);
    } catch {
      detailStr = " [Unserializable Details]";
    }
  }

  const logLine = `[${timestamp}] [${level}] [${event}]${detailStr}\n`;

  // Always log to console as well for PM2/stdout capture
  if (level === "ERROR") {
    console.error(`[WhatsApp] ${event}`, details || "");
  } else if (level === "WARN") {
    console.warn(`[WhatsApp] ${event}`, details || "");
  } else {
    console.log(`[WhatsApp] ${event}`, details || "");
  }

  try {
    rotateLogIfNeeded();
    fs.appendFileSync(LOG_FILE, logLine, "utf-8");
  } catch (err) {
    console.error("[WhatsAppLogger] Failed to append to log file:", err);
  }
}

export const logger = {
  info: (event: string, details?: Record<string, unknown>) => writeWhatsAppLog("INFO", event, details),
  warn: (event: string, details?: Record<string, unknown>) => writeWhatsAppLog("WARN", event, details),
  error: (event: string, details?: Record<string, unknown>) => writeWhatsAppLog("ERROR", event, details),
  debug: (event: string, details?: Record<string, unknown>) => writeWhatsAppLog("DEBUG", event, details),
};
