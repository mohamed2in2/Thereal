const EGYPT_MOBILE_REGEX = /^01[0-9]{9}$/;

export function normalizeEgyptPhone(input: string) {
  const raw = String(input || "").trim();
  // convert Arabic-Indic numerals to ASCII digits
  const arabicMap: Record<string, string> = {
    '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4', '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
    '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4', '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
  };
  let cleaned = raw.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => arabicMap[d] || d);
  // remove international 00 prefix -> +
  cleaned = cleaned.replace(/^00/, "+");
  // If the input is already E.164 (starts with +), accept as-is to support non-Egyptian E.164 numbers
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.replace(/\D/g, "");
    // If it's an Egyptian E.164 return normalized +20... format
    if (digitsOnly.startsWith("20") && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    // Otherwise assume caller provided a valid E.164 number (e.g., TWILIO_FROM_NUMBER)
    return cleaned;
  }
  const digits = cleaned.replace(/\D/g, "");

  // +20XXXXXXXXXX or 20XXXXXXXXXX
  if ((digits.startsWith("20") || digits.startsWith("2")) && digits.length === 12) {
    return `+${digits}`;
  }

  // local 01XXXXXXXXX
  if (EGYPT_MOBILE_REGEX.test(digits)) {
    return `+20${digits.slice(1)}`;
  }

  // Fallback: if the digits string contains an occurrence of 01XXXXXXXXX, extract it
  const found = digits.match(/01[0-9]{9}/);
  if (found) {
    const m = found[0];
    return `+20${m.slice(1)}`;
  }

  throw new Error("رقم الهاتف غير صالح. استخدم رقم مصري يبدأ بـ 01");
}

export function formatDisplayPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return digits;
  }
  if (digits.startsWith("20") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("2") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return input;
}
