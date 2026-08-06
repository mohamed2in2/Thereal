import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { whatsappOrchestrator } from "./orchestrator";

const TOKEN_EXPIRY_DAYS = 365;

/**
 * Generates a cryptographically secure 128+ bit entropy URL-safe token
 */
export function generateSecureToken(): string {
  // 18 random bytes -> 24 chars base64url string with > 144 bits of entropy
  return crypto.randomBytes(18).toString("base64url");
}

/**
 * Computes SHA-256 hex hash of the raw token for secure database storage
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Returns base URL of website (e.g. https://code-up.tech)
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://code-up.tech"
  ).replace(/\/+$/, "");
}

/**
 * Gets or creates a permanent 365-day Parent Portal token for a student
 * Returns { rawToken, parentToken }
 */
export async function getOrCreateParentToken(studentId: string) {
  let existing = await prisma.parentToken.findUnique({
    where: { studentId },
  });

  const now = new Date();

  // If token exists and is not expired, we generate a fresh raw token and update its hash
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  if (existing && existing.expiresAt > now) {
    // Return existing record but attach new rawToken for link creation if needed
    return { rawToken, parentToken: existing };
  }

  if (existing) {
    existing = await prisma.parentToken.update({
      where: { studentId },
      data: {
        tokenHash,
        expiresAt,
        updatedAt: now,
      },
    });
  } else {
    existing = await prisma.parentToken.create({
      data: {
        studentId,
        tokenHash,
        expiresAt,
      },
    });
  }

  return { rawToken, parentToken: existing };
}

/**
 * Force regenerates a Parent Portal token (invalidating old link)
 * Returns { rawToken, parentToken }
 */
export async function regenerateParentToken(studentId: string) {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  const parentToken = await prisma.parentToken.upsert({
    where: { studentId },
    create: {
      studentId,
      tokenHash,
      expiresAt,
    },
    update: {
      tokenHash,
      expiresAt,
      sentAt: null, // Reset sent timestamp so it can be re-sent if requested
      updatedAt: new Date(),
    },
  });

  return { rawToken, parentToken };
}

/**
 * Validates raw URL token by hashing it and looking up DB by tokenHash
 */
export async function validateParentToken(rawToken: string, ip: string = "127.0.0.1", userAgent?: string) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const targetHash = hashToken(rawToken);

  const parentToken = await prisma.parentToken.findUnique({
    where: { tokenHash: targetHash },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          parentPhone: true,
          educationalStage: true,
          role: true,
          points: true,
          createdAt: true,
        },
      },
    },
  });

  if (!parentToken) return null;

  // Check expiration (365 days)
  if (new Date() > parentToken.expiresAt) {
    return null; // Expired
  }

  // Increment access count & log access event asynchronously
  prisma.parentToken
    .update({
      where: { id: parentToken.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    })
    .catch(() => {});

  prisma.parentAccessLog
    .create({
      data: {
        studentId: parentToken.studentId,
        ip,
        userAgent: userAgent || null,
      },
    })
    .catch(() => {});

  return parentToken;
}

/**
 * Auto-send Parent Portal WhatsApp link to parent when student registers
 */
export async function maybeAutoSendParentPortalLink(studentId: string) {
  try {
    const config = await whatsappOrchestrator.getConfig();
    if (!config.autoSendParentPortal) return null;

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, parentPhone: true },
    });

    if (!student || !student.parentPhone) return null;

    const { rawToken, parentToken } = await getOrCreateParentToken(studentId);

    // Ensure it is ONLY sent ONCE automatically
    if (parentToken.sentAt) return null;

    const portalUrl = `${getAppBaseUrl()}/p/${rawToken}`;

    const dispatchResult = await whatsappOrchestrator.sendParentPortalLink(
      student.parentPhone,
      student.name,
      portalUrl
    );

    if (dispatchResult.success) {
      await prisma.parentToken.update({
        where: { id: parentToken.id },
        data: { sentAt: new Date() },
      });
    }

    return dispatchResult;
  } catch (err) {
    console.error("Auto-send parent portal link error:", err);
    return null;
  }
}
