import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { generateVerificationCode, sendVerificationCode } from "@/lib/whatsapp";
import { createPhoneVerificationChallenge, setPhoneVerificationCookie } from "@/lib/auth";
import { checkCooldown } from "@/lib/cooldown";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

export async function POST(req: NextRequest) {
  try {
    const { phone, forceChannel, recaptchaToken } = await req.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "رقم المتعلم مطلوب" }, { status: 400 });
    }

    // ── reCAPTCHA Enterprise verification ──────────────────────────────────────
    if (recaptchaToken) {
      const captcha = await verifyRecaptchaToken(recaptchaToken, "send_code");
      if (!captcha.success) {
        console.warn("[reCAPTCHA] send-code blocked — score:", captcha.score, "reasons:", captcha.reasons);
        return NextResponse.json({ error: "تم اكتشاف نشاط مشبوه. يرجى المحاولة مرة أخرى." }, { status: 403 });
      }
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEgyptPhone(phone);
    } catch {
      return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
    }

    const generatedEmail = `${normalizedPhone.replace("+", "")}@students.code-up.tech`;

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: generatedEmail }, { phone: normalizedPhone }],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "هذا الرقم مسجل بالفعل" }, { status: 409 });
    }

    const bypass = isPhoneVerificationBypassed();

    if (bypass) {
      return NextResponse.json({ success: true, bypass, channel: "dev" });
    }

    // Server-side cooldown validation: 60 seconds per phone number
    const cooldownCheck = checkCooldown(normalizedPhone, 60000);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        { error: `يرجى الانتظار ${cooldownCheck.remainingSeconds} ثانية قبل محاولة إرسال الرمز مجدداً.` },
        { status: 429 }
      );
    }

    // Generate code and send via requested channel (or WhatsApp with SMS fallback)
    const code = generateVerificationCode();
    const result = await sendVerificationCode(normalizedPhone, code, forceChannel === "sms" ? "sms" : undefined);

    // Store the code hash in a secure HTTP-only cookie for verification
    const challengeToken = await createPhoneVerificationChallenge(normalizedPhone, code);
    await setPhoneVerificationCookie(challengeToken);

    return NextResponse.json({ success: true, channel: result.channel, bypass });
  } catch (error) {
    console.error("Phone verification code route error:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}