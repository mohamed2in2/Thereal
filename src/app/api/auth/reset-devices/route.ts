import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { normalizeEgyptPhone } from "@/lib/phone";
import { readDeviceId, setDeviceCookie, deviceLabelFromUA } from "@/lib/devices";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: string; password?: string; recaptchaToken?: string };
    const { phone, password, recaptchaToken } = body;

    if (recaptchaToken) {
      const captcha = await verifyRecaptchaToken(recaptchaToken, "login");
      if (!captcha.success) {
        return NextResponse.json({ error: "تم اكتشاف نشاط مشبوه. يرجى المحاولة مرة أخرى." }, { status: 403 });
      }
    }

    if (!phone || !password) {
      return NextResponse.json({ error: "رقم الهاتف وكلمة المرور مطلوبان" }, { status: 400 });
    }

    const normalizedPhone = normalizeEgyptPhone(String(phone));
    const user = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    if (user.role !== "student") {
      return NextResponse.json({ error: "استخدم لوحة الإدارة لتسجيل الدخول" }, { status: 403 });
    }

    // Remove all old registered devices for this user
    await prisma.device.deleteMany({ where: { userId: user.id } });

    // Register current device
    const { deviceId, isNew } = await readDeviceId();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.device.create({
      data: { userId: user.id, deviceId, label: deviceLabelFromUA(userAgent), userAgent, ipAddress },
    });

    const token = await signToken({ id: user.id, email: user.email, name: user.name, role: user.role, deviceId });
    await setAuthCookie(token);
    if (isNew) await setDeviceCookie(deviceId);

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Reset devices error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
