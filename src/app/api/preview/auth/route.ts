import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  PREVIEW_COOKIE_NAME,
  PREVIEW_COOKIE_MAX_AGE,
  generatePreviewCookieToken,
  verifyPreviewCookie,
  verifyPreviewPassword,
} from "@/lib/preview-auth";
import { getClientIp } from "@/lib/vpn-guard";

/**
 * Validates whether the caller is authorized to view the CTO / Teacher DRM preview portal.
 * Authorized if:
 * 1. Logged in with role: superadmin, admin, teacher
 * 2. OR possesses a valid preview cookie
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (session && ["superadmin", "admin", "teacher"].includes(session.role)) {
      return NextResponse.json({
        authorized: true,
        role: session.role,
        name: session.name,
      });
    }

    const cookie = req.cookies.get(PREVIEW_COOKIE_NAME)?.value;
    if (verifyPreviewCookie(cookie)) {
      return NextResponse.json({
        authorized: true,
        role: "cto_preview",
        name: "Code-UP CTO Preview",
      });
    }

    return NextResponse.json({ authorized: false });
  } catch {
    return NextResponse.json({ authorized: false });
  }
}

interface AttemptRecord {
  attempts: number;
  resetAt: number;
}
const previewRateLimits = new Map<string, AttemptRecord>();

function checkPreviewRateLimit(ip: string, maxAttempts = 5, windowMs = 60000): { allowed: boolean; resetSeconds: number } {
  const now = Date.now();
  const rec = previewRateLimits.get(ip);
  if (!rec || rec.resetAt <= now) {
    previewRateLimits.set(ip, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true, resetSeconds: 0 };
  }
  if (rec.attempts >= maxAttempts) {
    return { allowed: false, resetSeconds: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.attempts += 1;
  return { allowed: true, resetSeconds: 0 };
}

/**
 * Authenticates with preview password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rateCheck = checkPreviewRateLimit(ip, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `تم تجاوز الحد الأقصى للمحاولات. يرجى الانتظار ${rateCheck.resetSeconds} ثانية.` },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const inputPassword = (body.password || "").trim();

    if (!inputPassword) {
      return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
    }

    if (!verifyPreviewPassword(inputPassword)) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const cookieToken = generatePreviewCookieToken();
    if (!cookieToken) {
      return NextResponse.json({ error: "خدمة المعاينة غير مهيأة في بيئة الإنتاج" }, { status: 503 });
    }

    const res = NextResponse.json({
      success: true,
      message: "تم التحقق بنجاح",
      role: "cto_preview",
    });

    res.cookies.set(PREVIEW_COOKIE_NAME, cookieToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء التحقق";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

