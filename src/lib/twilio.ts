import { normalizeEgyptPhone } from "@/lib/phone";
import { randomInt } from "crypto";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const TWILIO_VERIFY_BASE = "https://verify.twilio.com/v2";

const DEV_SKIP_SMS = process.env.DEV_SKIP_SMS === "true";
const USE_VERIFY = process.env.TWILIO_USE_VERIFY === "true";
const BYPASS_PHONE_VERIFICATION = process.env.TWILIO_BYPASS_VERIFICATION === "true";

export function isDevSkipSmsEnabled() {
  return DEV_SKIP_SMS;
}

export function isTwilioVerifyEnabled() {
  return USE_VERIFY;
}

export function isPhoneVerificationBypassed() {
  return BYPASS_PHONE_VERIFICATION;
}

export type TwilioSendResult = {
  method: "dev" | "sms" | "verify";
  dev?: boolean;
  code?: string;
  sid?: string;
  verification_sid?: string;
  [key: string]: unknown;
};

function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{4})/g, "*");
}

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function getMessagingAuth() {
  const apiKey = process.env.TWILIO_API_KEY_SID;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (apiKey && apiSecret) {
    return { username: apiKey, password: apiSecret, accountSid };
  }
  if (accountSid && authToken) {
    return { username: accountSid, password: authToken, accountSid };
  }
  throw new Error("Twilio credentials missing. Set TWILIO_API_KEY_SID & TWILIO_API_SECRET (preferred) or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN");
}

async function fetchWithRetries(url: string, options: RequestInit, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status >= 500 || res.status === 429) {
      attempt++;
      const backoff = 200 * Math.pow(2, attempt);
      await delay(backoff);
      continue;
    }
    return res;
  }
  // last attempt
  return fetch(url, options);
}

export async function sendVerificationSms(phone: string, code: string): Promise<TwilioSendResult> {
  console.log("twilio.sendVerificationSms received phone:", typeof phone, JSON.stringify(phone));
  let toNumber: string;
  // If already E.164 for Egypt, accept as-is to avoid double-normalization issues
  if (typeof phone === "string" && /^\+20\d{10}$/.test(phone)) {
    toNumber = phone;
  } else {
    toNumber = normalizeEgyptPhone(phone);
  }

  if (DEV_SKIP_SMS || BYPASS_PHONE_VERIFICATION) {
    // Local dev helper — do not use in production. Return the generated code for UI convenience.
    console.log(`[${DEV_SKIP_SMS ? "DEV_SKIP_SMS" : "TWILIO_BYPASS_VERIFICATION"}] Skipping SMS to ${maskPhone(toNumber)} — code=${code}`);
    return { dev: true, code, method: "dev" };
  }

  if (USE_VERIFY) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID is required when TWILIO_USE_VERIFY=true");

    const apiKey = process.env.TWILIO_API_KEY_SID;
    const apiSecret = process.env.TWILIO_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("TWILIO_API_KEY_SID and TWILIO_API_SECRET required for Verify API");

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const url = `${TWILIO_VERIFY_BASE}/Services/${serviceSid}/Verifications`;
    const body = new URLSearchParams({ To: toNumber, Channel: "sms" });

    const res = await fetchWithRetries(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Twilio Verify send failed: ${res.status} ${txt}`);
    }

    const json = await res.json();
    console.log(`Twilio Verify sent to ${maskPhone(toNumber)}; sid=${json.sid || json.verification_sid || 'n/a'}`);
    return { ...json, method: "verify" } as TwilioSendResult;
  }

  // Messaging API fallback
  const { username, password, accountSid } = getMessagingAuth();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  // TWILIO_FROM_NUMBER can be any E.164 number (not necessarily Egyptian).
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER || "");
  if (!fromNumber) throw new Error("TWILIO_FROM_NUMBER is required for Messaging API");
  const body = new URLSearchParams({ To: toNumber, From: fromNumber, Body: `Code-UP verification code: ${code}. This code expires in 10 minutes.` });

  const res = await fetchWithRetries(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Twilio Messaging send failed: ${res.status} ${txt}`);
  }

  const json = await res.json();
  console.log(`Twilio message sent to ${maskPhone(toNumber)}; sid=${json.sid || 'n/a'}`);
  return { ...json, method: "sms" } as TwilioSendResult;
}

export async function verifyCode(phone: string, code: string) {
  if (BYPASS_PHONE_VERIFICATION) {
    return true;
  }

  if (!USE_VERIFY) {
    // Not using Verify API — caller should validate via stored challenge (cookie).
    return false;
  }

  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID is required for verification checks");
  const apiKey = process.env.TWILIO_API_KEY_SID;
  const apiSecret = process.env.TWILIO_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("TWILIO_API_KEY_SID and TWILIO_API_SECRET required for Verify API");

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = `${TWILIO_VERIFY_BASE}/Services/${serviceSid}/VerificationCheck`;
  const body = new URLSearchParams({ To: normalizeEgyptPhone(phone), Code: code });

  const res = await fetchWithRetries(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Twilio verify check error:", res.status, txt);
    return false;
  }

  const json = await res.json();
  return json && (json.status === "approved" || json.status === "pending" && json.valid);
}

export function generateVerificationCode() {
  return String(100000 + randomInt(900000));
}
