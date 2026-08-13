/**
 * reCAPTCHA Enterprise — server-side token verification.
 *
 * Uses the REST API so there is no extra npm dependency:
 * https://cloud.google.com/recaptcha-enterprise/docs/create-assessment
 *
 * Required environment variables (never exposed to browser):
 *   RECAPTCHA_API_KEY   – Google Cloud API key with reCAPTCHA Enterprise enabled
 *
 * Public env var (safe to expose):
 *   NEXT_PUBLIC_RECAPTCHA_SITE_KEY – the site key shown in the reCAPTCHA console
 */

const PROJECT_ID = "codeup-ef28b";
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "6LcJ2xUtAAAAAI4MhIos69DhEOTNN17K-QXmoIXr";

export interface RecaptchaResult {
  /** Whether the token passed basic validation (score >= threshold). */
  success: boolean;
  /** Risk score from 0.0 (likely bot) to 1.0 (likely human). */
  score: number;
  /** Reason codes returned by the API (e.g. "BROWSER_ERROR"). */
  reasons: string[];
  /** Raw assessment name (useful for annotation). */
  assessmentName?: string;
}

/**
 * Whether reCAPTCHA is actually armed on this deployment.
 *
 * Callers use this to decide whether a *missing* token is acceptable. Treating
 * "no token supplied" as "no check needed" made the whole bot defence opt-in
 * from the client's side: an attacker just omitted the field.
 */
export function isRecaptchaEnforced(): boolean {
  return process.env.RECAPTCHA_BYPASS !== "true" && !!process.env.RECAPTCHA_API_KEY;
}

/**
 * Verify a reCAPTCHA Enterprise token on the server.
 *
 * @param token        The token produced by grecaptcha.enterprise.execute()
 * @param expectedAction  The action string you passed to execute(), e.g. "login"
 * @param scoreThreshold  Minimum score to consider valid (default 0.5)
 */
export async function verifyRecaptchaToken(
  token: string,
  expectedAction: string,
  scoreThreshold = 0.5
): Promise<RecaptchaResult> {
  // Allow bypass in dev/testing mode when explicitly set or bypass is enabled
  if (process.env.RECAPTCHA_BYPASS === "true") {
    return { success: true, score: 1, reasons: ["BYPASS"] };
  }

  const apiKey = process.env.RECAPTCHA_API_KEY;

  // If no API key is configured, skip verification gracefully (dev / CI).
  if (!apiKey) {
    console.warn("[reCAPTCHA] RECAPTCHA_API_KEY is not set — skipping verification.");
    return { success: true, score: 1, reasons: ["SKIPPED_NO_API_KEY"] };
  }

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${apiKey}`;

  const body = {
    event: {
      token,
      expectedAction,
      siteKey: SITE_KEY,
    },
  };

  let data: any;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (err) {
    console.error("[reCAPTCHA] Network error calling assessment API:", err);
    // Fail open so a network blip doesn't lock out all users.
    return { success: true, score: 0.5, reasons: ["NETWORK_ERROR"] };
  }

  // The API returns an error object when the token is invalid or malformed.
  if (data?.error) {
    console.error("[reCAPTCHA] Assessment API error:", data.error);
    return { success: false, score: 0, reasons: ["API_ERROR"] };
  }

  const tokenProps = data?.tokenProperties ?? {};
  const riskAnalysis = data?.riskAnalysis ?? {};
  const score: number = riskAnalysis.score ?? 0;
  const reasons: string[] = riskAnalysis.reasons ?? [];

  // Token must be valid and the action must match what we expected.
  if (!tokenProps.valid) {
    return { success: false, score: 0, reasons: ["INVALID_TOKEN", ...(tokenProps.invalidReason ? [tokenProps.invalidReason] : []), ...reasons] };
  }

  if (tokenProps.action && tokenProps.action !== expectedAction) {
    return { success: false, score, reasons: ["ACTION_MISMATCH", ...reasons] };
  }

  return {
    success: score >= scoreThreshold,
    score,
    reasons,
    assessmentName: data?.name,
  };
}
