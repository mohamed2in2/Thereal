import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Persistent per-browser device identifier. Stored in an httpOnly cookie so the
 * server can recognise a returning device and enforce the per-account device
 * limit (anti account-sharing). Deleting the cookie just looks like a new
 * device — which still counts against the limit, so it's no bypass.
 */
export const DEVICE_COOKIE = "device_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Reads the device id from cookies, generating (but not yet persisting) one if absent. */
export async function readDeviceId(): Promise<{ deviceId: string; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{16,}$/i.test(existing)) return { deviceId: existing, isNew: false };
  return { deviceId: randomUUID(), isNew: true };
}

export async function setDeviceCookie(deviceId: string) {
  const store = await cookies();
  const isSecure = process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES === "true";
  store.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
  });
}

/** Human-friendly device label from a User-Agent string, e.g. "Chrome · Android". */
export function deviceLabelFromUA(ua: string | null | undefined): string {
  if (!ua) return "جهاز غير معروف";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "متصفح";
  const os =
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS|Macintosh/.test(ua) ? "Mac" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
