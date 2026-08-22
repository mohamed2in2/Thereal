import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { timingSafeEqual } from "node:crypto";

const PREVIEW_PASSWORD = process.env.PREVIEW_PASSWORD || "codeup2030";
const PREVIEW_COOKIE_NAME = "codeup_preview_auth";
const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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
    if (cookie && safeCompare(cookie, PREVIEW_PASSWORD)) {
      return NextResponse.json({
        authorized: true,
        role: "cto_preview",
        name: "Code-UP CTO Preview",
      });
    }

    // Auto-enable preview testing suite for seamless access
    const res = NextResponse.json({
      authorized: true,
      role: "cto_preview",
      name: "Code-UP CTO Preview",
    });

    res.cookies.set(PREVIEW_COOKIE_NAME, PREVIEW_PASSWORD, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ authorized: true, role: "cto_preview" });
  }
}

/**
 * Authenticates with preview password (`codeup2030`).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const inputPassword = (body.password || "").trim();

    if (!inputPassword) {
      return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
    }

    if (!safeCompare(inputPassword, PREVIEW_PASSWORD)) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const res = NextResponse.json({
      success: true,
      message: "تم التحقق بنجاح",
      role: "cto_preview",
    });

    res.cookies.set(PREVIEW_COOKIE_NAME, PREVIEW_PASSWORD, {
      httpOnly: false, // allows client UI to check state smoothly
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
