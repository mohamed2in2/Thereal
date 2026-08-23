import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { whatsappOrchestrator } from "./orchestrator";
import { notifyParentVerificationRequired } from "@/lib/notifications";

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
 * Validates Egyptian mobile numbers (010, 011, 012, 015 or E.164 +20...)
 */
export function isValidEgyptianMobile(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const clean = phone.trim().replace(/\s+/g, "");
  if (/^01[0125]\d{8}$/.test(clean)) return true;
  if (/^\+201[0125]\d{8}$/.test(clean)) return true;
  return false;
}

/**
 * Gets or creates a permanent 365-day Parent Portal token for a student.
 *
 * `rawToken` is null when an existing, still-valid token was reused — the raw
 * value is unrecoverable by design (only its hash is stored), so callers that
 * need a sendable URL must pass `regenerate: true` and accept that any link
 * already in the parent's hands stops working.
 */
export async function getOrCreateParentToken(
  studentId: string,
  options?: { regenerate?: boolean }
): Promise<{ rawToken: string | null; parentToken: Awaited<ReturnType<typeof prisma.parentToken.create>> }> {
  let existing = await prisma.parentToken.findUnique({
    where: { studentId },
  });

  const now = new Date();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  if (existing && existing.expiresAt > now && !options?.regenerate) {
    // Reuse, don't rotate. Overwriting tokenHash here killed the link already
    // sent to the parent while returning a fresh raw token that callers such as
    // maybeAutoSendParentPortalLink then decline to send (because sentAt is
    // set) — leaving the parent with a dead URL and no replacement. Callers that
    // genuinely want a new link pass regenerate:true or use
    // regenerateParentToken().
    return { rawToken: null, parentToken: existing };
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

  // Reject dead/revoked tokens
  if (parentToken.status === "REJECTED" || parentToken.status === "REVOKED") {
    return null;
  }

  // Check expiration
  if (new Date() > parentToken.expiresAt) {
    return null; // Expired
  }

  // Log OPENED event on first access of a PENDING token
  if (parentToken.status === "PENDING" && parentToken.accessCount === 0) {
    prisma.parentVerificationEvent.create({
      data: {
        studentId: parentToken.studentId,
        action: "OPENED",
        phone: parentToken.parentPhoneSnapshot || parentToken.student?.parentPhone || null,
        ip,
        userAgent: userAgent || null,
      },
    }).catch(() => {});
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
 * Confirm parent identity when recipient taps "YES"
 */
export async function confirmParentToken(rawToken: string, ip: string = "127.0.0.1", userAgent?: string) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const targetHash = hashToken(rawToken);
  const parentToken = await prisma.parentToken.findUnique({
    where: { tokenHash: targetHash },
    include: { student: true },
  });

  if (!parentToken || !parentToken.student) return null;

  if (parentToken.status === "REJECTED" || parentToken.status === "REVOKED") {
    return null;
  }

  if (new Date() > parentToken.expiresAt) {
    return null;
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.parentToken.updateMany({
      where: {
        id: parentToken.id,
        status: { notIn: ["REJECTED", "REVOKED"] },
        expiresAt: { gte: now },
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: now,
        confirmedByIp: ip,
        updatedAt: now,
      },
    });

    if (claim.count === 0) return null;

    await tx.user.update({
      where: { id: parentToken.studentId },
      data: {
        parentVerified: true,
        parentVerifiedAt: now,
        parentVerificationStatus: "CONFIRMED",
      },
    });

    await tx.parentVerificationEvent.create({
      data: {
        studentId: parentToken.studentId,
        action: "CONFIRMED",
        phone: parentToken.parentPhoneSnapshot || parentToken.student.parentPhone || null,
        ip,
        userAgent: userAgent || null,
      },
    });

    return { ok: true, studentId: parentToken.studentId };
  });
}

/**
 * Reject parent identity when recipient taps "NO" — CRITICAL CRYPTOGRAPHIC BURN
 * Overwrites tokenHash with an unrelated random hash so old URL is permanently dead.
 */
export async function rejectParentToken(rawToken: string, ip: string = "127.0.0.1", userAgent?: string) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const targetHash = hashToken(rawToken);
  const parentToken = await prisma.parentToken.findUnique({
    where: { tokenHash: targetHash },
    include: { student: true },
  });

  if (!parentToken || !parentToken.student) return null;

  const now = new Date();
  const deadHash = hashToken(generateSecureToken());

  await prisma.parentToken.update({
    where: { id: parentToken.id },
    data: {
      tokenHash: deadHash,
      status: "REJECTED",
      rejectedAt: now,
      revokedAt: now,
      updatedAt: now,
    },
  });

  await prisma.user.update({
    where: { id: parentToken.studentId },
    data: {
      parentVerified: false,
      parentVerificationStatus: "REJECTED",
    },
  });

  await prisma.parentVerificationEvent.create({
    data: {
      studentId: parentToken.studentId,
      action: "REJECTED",
      phone: parentToken.parentPhoneSnapshot || parentToken.student.parentPhone || null,
      ip,
      userAgent: userAgent || null,
    },
  });

  notifyParentVerificationRequired(parentToken.studentId).catch(() => {});

  return { ok: true, studentId: parentToken.studentId };
}

export async function resetParentVerificationLimits(studentId: string) {
  await prisma.parentToken.updateMany({
    where: { studentId },
    data: { issueCount: 0 },
  });

  await prisma.parentVerificationEvent.deleteMany({
    where: {
      studentId,
      action: "REISSUED",
    },
  });
}

/**
 * Student re-issues parent link with a new phone number
 */
export async function reissueParentToken(
  studentId: string,
  newParentPhone: string,
  ip: string = "127.0.0.1",
  userAgent?: string,
  options?: { allowSamePhone?: boolean; bypassRateLimit?: boolean; resetLimits?: boolean }
) {
  if (options?.resetLimits) {
    await resetParentVerificationLimits(studentId);
  }

  if (!isValidEgyptianMobile(newParentPhone)) {
    throw new Error("رقم الهاتف غير صحيح. يجب أن يكون رقم موبايل مصري يبدأ بـ 010 أو 011 أو 012 أو 015.");
  }

  const cleanPhone = newParentPhone.trim().replace(/\s+/g, "");

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, parentPhone: true },
  });

  if (!student) {
    throw new Error("المتعلم غير موجود.");
  }

  const existingToken = await prisma.parentToken.findUnique({
    where: { studentId },
  });

  if (!options?.allowSamePhone && existingToken?.parentPhoneSnapshot && existingToken.parentPhoneSnapshot === cleanPhone) {
    throw new Error("الرقم ده نفس الرقم القديم. من فضلك اكتب رقم ولي أمرك الحقيقي.");
  }

  if (!options?.bypassRateLimit) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReissues = await prisma.parentVerificationEvent.count({
      where: {
        studentId,
        action: "REISSUED",
        createdAt: { gte: sevenDaysAgo },
      },
    });

    if (recentReissues >= 3) {
      throw new Error("وصلت للحد الأقصى لتغيير رقم ولي الأمر خلال هذا الأسبوع (3 مرات). يرجى التواصل مع الدعم.");
    }
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
  const now = new Date();

  const isPhoneChanged = !existingToken?.parentPhoneSnapshot || existingToken.parentPhoneSnapshot !== cleanPhone;

  const parentToken = await prisma.parentToken.upsert({
    where: { studentId },
    create: {
      studentId,
      tokenHash,
      status: "PENDING",
      parentPhoneSnapshot: cleanPhone,
      issueCount: 1,
      expiresAt,
    },
    update: {
      tokenHash,
      status: "PENDING",
      parentPhoneSnapshot: cleanPhone,
      issueCount: isPhoneChanged ? { increment: 1 } : undefined,
      confirmedAt: null,
      confirmedByIp: null,
      rejectedAt: null,
      revokedAt: null,
      sentAt: null,
      expiresAt,
      updatedAt: now,
    },
  });

  await prisma.user.update({
    where: { id: studentId },
    data: {
      parentPhone: cleanPhone,
      parentVerified: false,
      parentVerificationStatus: "PENDING",
    },
  });

  await prisma.parentVerificationEvent.create({
    data: {
      studentId,
      action: "REISSUED",
      phone: cleanPhone,
      ip,
      userAgent: userAgent || null,
    },
  });

  const portalUrl = `${getAppBaseUrl()}/p/${rawToken}`;
  const dispatchResult = await whatsappOrchestrator.sendParentPortalLink(
    cleanPhone,
    student.name,
    portalUrl
  );

  if (dispatchResult.success) {
    await prisma.parentToken.update({
      where: { id: parentToken.id },
      data: { sentAt: new Date() },
    });
  }

  return { rawToken, parentToken, dispatchResult };
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

    const existingToken = await prisma.parentToken.findUnique({
      where: { studentId },
      select: { sentAt: true },
    });

    // Ensure it is ONLY sent ONCE automatically
    if (existingToken?.sentAt) return null;

    // Nothing has been delivered yet, so minting a fresh raw token here cannot
    // orphan a link the parent already holds.
    const { rawToken, parentToken } = await getOrCreateParentToken(studentId, { regenerate: true });

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
