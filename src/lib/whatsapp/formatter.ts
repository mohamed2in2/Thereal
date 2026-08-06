export interface FormattedMessageResult {
  phoneE164: string;
  jid: string;
}

/**
  Normalizes phone numbers to E.164 format and converts to WhatsApp JID.
  E.g. "01012345678" -> "+201012345678" & "201012345678@s.whatsapp.net"
  E.g. "+201012345678" -> "+201012345678" & "201012345678@s.whatsapp.net"
 */
export function normalizePhoneToJid(rawPhone: string): FormattedMessageResult {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new Error("Phone number is required and must be a string.");
  }

  // Remove spaces, hyphens, parentheses, and leading/trailing whitespace
  let clean = rawPhone.replace(/[\s\-\(\)]/g, "").trim();

  // If local Egyptian phone starting with 01 (e.g. 01012345678), prepends country code 2
  if (/^01[0-9]{9}$/.test(clean)) {
    clean = "2" + clean;
  }

  // If starts with 00, replace with +
  if (clean.startsWith("00")) {
    clean = "+" + clean.substring(2);
  }

  // Remove leading '+' if present for digits only check
  let digits = clean.startsWith("+") ? clean.substring(1) : clean;

  // Validate digits
  if (!/^\d{10,15}$/.test(digits)) {
    throw new Error(`Invalid phone number format: "${rawPhone}". Must contain 10-15 digits.`);
  }

  const phoneE164 = `+${digits}`;
  const jid = `${digits}@s.whatsapp.net`;

  return { phoneE164, jid };
}

/**
 * Validates outgoing message content.
 */
export function validateMessageContent(message: string): void {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw new Error("Message content cannot be empty.");
  }

  if (message.length > 4096) {
    throw new Error(`Message length (${message.length}) exceeds WhatsApp limit of 4096 characters.`);
  }
}

/**
 * Default configurable OTP message template
 */
export function formatOTPMessage(otp: string, customTemplate?: string): string {
  if (customTemplate && customTemplate.includes("{{code}}")) {
    return customTemplate.replace("{{code}}", otp);
  }

  return `Code-UP

Your verification code is:

${otp}

This code expires in 5 minutes.

Do not share this code with anyone.`;
}
