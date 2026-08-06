import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/**
 * AI provider management. API keys are encrypted with AES-256-GCM before they
 * touch the database and are NEVER returned to the client — getActiveProviders()
 * exposes only a `hasKey` boolean. Decryption happens server-side, only inside
 * AI request handlers, via getDecryptedKey().
 */

// ── Encryption ──────────────────────────────────────────────────────────────
// The 32-byte AES key is derived (sha256) from CONFIG_ENCRYPTION_KEY so any
// passphrase length works; the env var itself never lands in the DB.
function aesKey(): Buffer {
  const secret = process.env.CONFIG_ENCRYPTION_KEY;
  if (!secret) throw new Error("CONFIG_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(secret).digest();
}

/** Returns "iv:authTag:ciphertext" (all base64). */
export function encryptSecret(plaintext: string): string {
  // Refuse to encrypt under a weak passphrase. SHA-256 gives no key-stretching,
  // so the security is only as strong as this string — require ≥32 chars.
  const secret = process.env.CONFIG_ENCRYPTION_KEY ?? "";
  if (secret.length < 32) {
    throw new Error("CONFIG_ENCRYPTION_KEY must be at least 32 characters (use a long random string)");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function encryptionConfigured(): boolean {
  return (process.env.CONFIG_ENCRYPTION_KEY?.length ?? 0) >= 32;
}

// ── Public (no-secret) shapes ────────────────────────────────────────────────
export interface PublicProvider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  models: string[];
  hasKey: boolean;
  isPrimary: boolean;
  isBackup: boolean;
  isActive: boolean;
}

function toPublic(p: {
  id: string; name: string; slug: string; baseUrl: string; models: string;
  apiKeyEnc: string | null; isPrimary: boolean; isBackup: boolean; isActive: boolean;
}): PublicProvider {
  let models: string[] = [];
  try {
    const parsed = JSON.parse(p.models);
    if (Array.isArray(parsed)) models = parsed.map(String);
  } catch {
    /* leave empty */
  }
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    baseUrl: p.baseUrl,
    models,
    hasKey: !!p.apiKeyEnc, // never the key itself
    isPrimary: p.isPrimary,
    isBackup: p.isBackup,
    isActive: p.isActive,
  };
}

/** All providers, keys stripped — safe to send to the client. */
export async function getActiveProviders(): Promise<PublicProvider[]> {
  try {
    const rows = await prisma.aIProvider.findMany({ orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
    return rows.map(toPublic);
  } catch {
    return []; // table missing / db error → empty list, no crash
  }
}

export function normalizeModels(models: unknown): string {
  if (Array.isArray(models)) {
    return JSON.stringify(models.map((m) => String(m).trim()).filter(Boolean));
  }
  if (typeof models === "string") {
    return JSON.stringify(
      models.split(/[\n,]/).map((m) => m.trim()).filter(Boolean)
    );
  }
  return "[]";
}

// ── Server-only secret access ────────────────────────────────────────────────
/** Decrypts a provider's key. Server-only; never call from client code. */
export async function getDecryptedKey(providerId: string): Promise<string | null> {
  const p = await prisma.aIProvider.findUnique({ where: { id: providerId }, select: { apiKeyEnc: true } });
  if (!p?.apiKeyEnc) return null;
  try {
    return decryptSecret(p.apiKeyEnc);
  } catch {
    return null;
  }
}

/** Detected request shape for a provider, from its base URL. */
export type ProviderKind = "anthropic" | "gemini" | "openai";
export function providerKind(baseUrl: string): ProviderKind {
  const u = baseUrl.toLowerCase();
  if (u.includes("anthropic")) return "anthropic";
  if (u.includes("googleapis") || u.includes("generativelanguage")) return "gemini";
  return "openai";
}

export interface ResolvedProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  kind: ProviderKind;
  key: string;
}

async function resolveOne(
  where: { isPrimary: true } | { isBackup: true }
): Promise<ResolvedProvider | null> {
  let p;
  try {
    p = await prisma.aIProvider.findFirst({ where: { ...where, isActive: true } });
  } catch {
    return null; // table missing / db error → no provider, falls back to default plan
  }
  if (!p || !p.apiKeyEnc) return null;
  let model = "";
  try {
    const parsed = JSON.parse(p.models);
    if (Array.isArray(parsed) && parsed.length) model = String(parsed[0]);
  } catch {
    /* no model */
  }
  if (!model) return null;
  let key: string;
  try {
    key = decryptSecret(p.apiKeyEnc);
  } catch {
    return null;
  }
  return { id: p.id, name: p.name, baseUrl: p.baseUrl, model, kind: providerKind(p.baseUrl), key };
}

/** The active primary / backup providers with decrypted keys — server-only. */
export async function resolvePlanProviders(): Promise<{
  primary: ResolvedProvider | null;
  backup: ResolvedProvider | null;
}> {
  let [primary, backup] = await Promise.all([
    resolveOne({ isPrimary: true }),
    resolveOne({ isBackup: true }),
  ]);

  if (!primary && process.env.AI_PRIMARY_API_KEY) {
    const baseUrl = process.env.AI_PRIMARY_BASE_URL || "https://api.anthropic.com/v1/messages";
    primary = {
      id: "env-primary",
      name: "Primary AI (ENV)",
      baseUrl,
      model: process.env.AI_PRIMARY_MODEL || "claude-3-5-sonnet-20241022",
      kind: providerKind(baseUrl),
      key: process.env.AI_PRIMARY_API_KEY,
    };
  }

  if (!backup && (process.env.AI_BACKUP_API_KEY || process.env.GEMINI_API_KEY)) {
    const key = process.env.AI_BACKUP_API_KEY || process.env.GEMINI_API_KEY || "";
    const rawBase = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
    const baseUrl = rawBase.replace(/\/+$/, "").replace(/\/models$/, "");
    backup = {
      id: "env-backup",
      name: "Backup AI (ENV)",
      baseUrl,
      model: process.env.AI_BACKUP_MODEL || "gemini-2.0-flash-lite",
      kind: providerKind(baseUrl),
      key,
    };
  }

  // A backup that's the same provider as the primary is not a real fallback —
  // ignore it so retrying actually hits a different provider.
  if (primary && backup && backup.id === primary.id) {
    return { primary, backup: null };
  }
  return { primary, backup };
}
