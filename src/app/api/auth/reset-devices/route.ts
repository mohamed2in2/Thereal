import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { normalizeEgyptPhone } from "@/lib/phone";
import { readDeviceId, setDeviceCookie, deviceLabelFromUA } from "@/lib/devices";
import {
  clearFailedLogins,
  enforceCaptcha,
  getLockoutState,
  lockoutResponseBody,
  recordFailedLogin,
} from "@/lib/login-guard";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: string; password?: string; recaptchaToken?: string };
    const { phone, password, recaptchaToken } = body;

    const captchaGate = await enforceCaptcha(recaptchaToken, "login");
    if (!captchaGate.ok) {
      return NextResponse.json({ error: captchaGate.error }, { status: captchaGate.status });
    }

    if (!phone || !password) {
      return NextResponse.json({ error: "رقم الهاتف وكلمة المرور مطلوبان" }, { status: 400 });
    }

    const normalizedPhone = normalizeEgyptPhone(String(phone));
    const user = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    // This endpoint wipes every registered device, so it is at least as
    // sensitive as login and gets the same lockout.
    const lockout = getLockoutState(user);
    if (lockout.locked) {
      return NextResponse.json(lockoutResponseBody(lockout.retryAfterSeconds), { status: 429 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordFailedLogin(user.id);
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    if (user.role !== "student") {
      return NextResponse.json({ error: "استخدم لوحة الإدارة لتسجيل الدخول" }, { status: 403 });
    }

    await clearFailedLogins(user.id);

    // Invalidate all prior sessions across all devices
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });

    // Remove all old registered devices for this user
    await prisma.device.deleteMany({ where: { userId: user.id } });

    // Register current device
    const { deviceId, isNew } = await readDeviceId();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.device.create({
      data: { userId: user.id, deviceId, label: deviceLabelFromUA(userAgent), userAgent, ipAddress },
    });

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId,
      tokenVersion: updatedUser.tokenVersion,
    });
    await setAuthCookie(token);
    if (isNew) await setDeviceCookie(deviceId);

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Reset devices error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
