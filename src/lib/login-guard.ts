import { prisma } from "./prisma";
import { getConfigNumberClamped } from "./config";
import { isRecaptchaEnforced, verifyRecaptchaToken } from "./recaptcha";

/**
 * Credential-stuffing and bot guards for the password login endpoints.
 *
 * Before this existed, `/api/auth/login` and `/api/auth/reset-devices` accepted
 * unlimited password guesses against a phone number — and their reCAPTCHA check
 * ran only when the client chose to send a token, so omitting the field skipped
 * it entirely. Egyptian mobile numbers are a small, enumerable keyspace, which
 * made offline-assembled credential lists cheap to replay.
 */

/**
 * Flat rather than a discriminated union: this project compiles with
 * `strict: false`, so `strictNullChecks`-based narrowing on `ok` does not apply
 * at call sites.
 */
export interface CaptchaGateResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Verifies a reCAPTCHA token, rejecting a *missing* token whenever reCAPTCHA is
 * armed. When it isn't configured (local dev, CI) the gate stays open.
 */
export async function enforceCaptcha(
  token: string | undefined | null,
  action: string
): Promise<CaptchaGateResult> {
  if (!token) {
    if (!isRecaptchaEnforced()) return { ok: true };
    return {
      ok: false,
      status: 400,
      error: "تعذر التحقق من أنك لست روبوت. يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.",
    };
  }

  const captcha = await verifyRecaptchaToken(token, action);
  if (!captcha.success) {
    console.warn(`[reCAPTCHA] ${action} blocked — score: ${captcha.score}, reasons: ${captcha.reasons.join(",")}`);
    return {
      ok: false,
      status: 403,
      error: "تم اكتشاف نشاط مشبوه. يرجى المحاولة مرة أخرى.",
    };
  }

  return { ok: true };
}

export interface LockoutState {
  locked: boolean;
  retryAfterSeconds: number;
}

/** Reports whether an account is currently locked out from password login. */
export function getLockoutState(user: { lockedUntil: Date | null }, now = new Date()): LockoutState {
  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Records a failed password attempt and locks the account once the configured
 * threshold is reached. Never throws — a bookkeeping failure must not turn a
 * wrong password into a 500.
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  try {
    const maxAttempts = await getConfigNumberClamped("max_login_attempts", 3, 50);
    const lockoutMinutes = await getConfigNumberClamped("lockout_minutes", 1, 1440);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= maxAttempts) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000),
          failedLoginAttempts: 0,
        },
      });
    }
  } catch (err) {
    console.error("[login-guard] failed to record login failure:", err);
  }
}

/** Clears the failure counter after a successful authentication. */
export async function clearFailedLogins(userId: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, OR: [{ failedLoginAttempts: { gt: 0 } }, { lockedUntil: { not: null } }] },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  } catch (err) {
    console.error("[login-guard] failed to clear login failures:", err);
  }
}

/** Shared 429 body for a locked account. */
export function lockoutResponseBody(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    error: `تم إيقاف محاولات الدخول مؤقتاً بسبب محاولات خاطئة متكررة. حاول مرة أخرى بعد ${minutes} دقيقة.`,
    code: "ACCOUNT_LOCKED",
    retryAfterSeconds,
  };
}
