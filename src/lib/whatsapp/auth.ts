import path from "path";
import fs from "fs";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { logger } from "./logger";

export const AUTH_DIR = path.join(process.cwd(), "whatsapp-auth");

export function ensureAuthDir(): void {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  } catch (err) {
    logger.error("Failed to create auth directory", { error: String(err) });
  }
}

export async function getAuthState() {
  ensureAuthDir();
  return await useMultiFileAuthState(AUTH_DIR);
}

export async function clearAuthState(): Promise<void> {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      logger.info("Cleared WhatsApp authentication state directory", { dir: AUTH_DIR });
    }
  } catch (err) {
    logger.error("Failed to clear auth state directory", { error: String(err) });
  }
}

export function hasExistingSession(): boolean {
  try {
    if (!fs.existsSync(AUTH_DIR)) return false;
    const files = fs.readdirSync(AUTH_DIR);
    return files.some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}
