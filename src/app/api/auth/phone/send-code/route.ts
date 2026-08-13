import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { generateVerificationCode, sendVerificationCode } from "@/lib/whatsapp";
import { createPhoneVerificationChallenge, setPhoneVerificationCookie } from "@/lib/auth";
import { checkCooldown } from "@/lib/cooldown";
import { OtpQuotaManager } from "@/services/otp/OtpQuotaManager";
import { enforceCaptcha } from "@/lib/login-guard";

export async function POST(req: NextRequest) {
  try {
    const { phone, forceChannel, recaptchaToken } = await req.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "رقم المتعلم مطلوب" }, { status: 400 });
    }

    // ── reCAPTCHA Enterprise verification ──────────────────────────────────────
    // Enforced even when the client omits the token — this endpoint spends real
    // WhatsApp/SMS quota per call.
    const captchaGate = await enforceCaptcha(recaptchaToken, "send_code");
    if (!captchaGate.ok) {
      return NextResponse.json({ error: captchaGate.error }, { status: captchaGate.status });
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

    // Signup OTPs draw on the same daily provider allowance as everything else.
    const quota = await OtpQuotaManager.reserveQuota("SIGNUP");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "تم بلوغ الحد اليومي لرسائل التحقق. يرجى المحاولة غداً." },
        { status: 429 }
      );
    }

    // Generate code and send via requested channel (or WhatsApp with SMS fallback)
    const code = generateVerificationCode();
    let result;
    try {
      result = await sendVerificationCode(normalizedPhone, code, forceChannel === "sms" ? "sms" : undefined);
    } catch (sendErr) {
      await OtpQuotaManager.releaseQuota("SIGNUP");
      throw sendErr;
    }

    // Persist the challenge server-side and hand the browser only its id.
    const challengeToken = await createPhoneVerificationChallenge(normalizedPhone, code);
    await setPhoneVerificationCookie(challengeToken);

    return NextResponse.json({ success: true, channel: result.channel, bypass });
  } catch (error) {
    console.error("Phone verification code route error:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}