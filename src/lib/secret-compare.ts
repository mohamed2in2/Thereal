import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time comparison of two shared secrets.
 *
 * Both sides are hashed first so the comparison length never depends on the
 * secret, and so mismatched lengths don't short-circuit (which would leak the
 * expected secret's length to a caller who can time the response).
 */
export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
