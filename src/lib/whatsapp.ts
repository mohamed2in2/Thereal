import { normalizeEgyptPhone } from "./phone";
import { randomInt } from "crypto";

export class WhatsAppSendError extends Error {
  status?: number;
  errorPayload?: any;

  constructor(message: string, status?: number, errorPayload?: any) {
    super(message);
    this.name = "WhatsAppSendError";
    this.status = status;
    this.errorPayload = errorPayload;
  }
}

export function generateVerificationCode(): string {
  return String(100000 + randomInt(900000));
}

/**
 * Sends a WhatsApp OTP using Meta Business Cloud API with an Authentication template.
 * Throws a WhatsAppSendError on failure or non-2xx response.
 */
export async function sendOtpWhatsApp(phoneE164: string, code: string): Promise<boolean> {
  // Offline mode — skip actual API call (useful for staging without WhatsApp credentials)
  if (process.env.WHATSAPP_OFFLINE === "true") {
    throw new WhatsAppSendError("WhatsApp is offline (WHATSAPP_OFFLINE=true)", 503);
  }

  const token = process.env.WHATSAPP_PERMANENT_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "ar_EG";
  // Set WHATSAPP_TEMPLATE_HAS_BUTTON="false" if your template has no URL button
  const templateHasButton = process.env.WHATSAPP_TEMPLATE_HAS_BUTTON !== "false";

  if (!token || !phoneId || !templateName) {
    throw new WhatsAppSendError(
      "WhatsApp Business API credentials or template name not configured.",
      500
    );
  }

  let recipient: string;
  try {
    recipient = normalizeEgyptPhone(phoneE164).replace("+", "");
  } catch (err: any) {
    throw new WhatsAppSendError(`Phone normalization failed: ${err.message}`, 400);
  }

  let components: object[] | undefined;

  // WHATSAPP_PARAMETER_NAME: the named variable defined in your Meta template (e.g. "otp_code", "code").
  // Required for templates created with named params ({{variable_name}} style).
  // Leave empty/unset only if your template uses old positional params ({{1}}, {{2}}).
  const paramName = process.env.WHATSAPP_PARAMETER_NAME || "";

  if (templateName === "3p_direct_integration_test_template") {
    // Meta's built-in test template needs no components
    components = undefined;
  } else {
    // Build the body parameter object — include parameter_name for named-variable templates
    const bodyParam: Record<string, string> = { type: "text", text: code };
    if (paramName) bodyParam.parameter_name = paramName;

    const bodyComponents: object[] = [
      {
        type: "body",
        parameters: [bodyParam],
      },
    ];

    if (templateHasButton) {
      const btnParam: Record<string, string> = { type: "text", text: code };
      if (paramName) btnParam.parameter_name = paramName;

      bodyComponents.push({
        type: "button",
        index: "0",
        sub_type: "url",
        parameters: [btnParam],
      });
    }

    components = bodyComponents;
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: templateLang,
      },
      components,
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.error?.message || `HTTP ${res.status}`;
      throw new WhatsAppSendError(
        `Meta API error: ${errorMsg}`,
        res.status,
        data?.error || data
      );
    }

    return true;
  } catch (err: any) {
    if (err instanceof WhatsAppSendError) {
      throw err;
    }
    throw new WhatsAppSendError(`Network/connection failure: ${err.message}`, 500);
  }
}

import { sendVerificationSms } from "./aws-sms";

/**
 * Orchestrator: Try to send via WhatsApp, and fall back to SMS on failure (or directly if forceChannel === 'sms').
 * Returns which channel was used.
 */
export async function sendVerificationCode(
  phone: string,
  code: string,
  forceChannel?: "sms" | "whatsapp"
): Promise<{ channel: "whatsapp" | "sms" }> {
  if (forceChannel === "sms") {
    await sendVerificationSms(phone, code);
    return { channel: "sms" };
  }

  try {
    await sendOtpWhatsApp(phone, code);
    return { channel: "whatsapp" };
  } catch (err: any) {
    console.error("WhatsApp delivery failed, falling back to SMS:", {
      message: err.message,
      status: err.status,
      errorPayload: err.errorPayload ? JSON.stringify(err.errorPayload).substring(0, 500) : undefined,
    });
    await sendVerificationSms(phone, code);
    return { channel: "sms" };
  }
}
