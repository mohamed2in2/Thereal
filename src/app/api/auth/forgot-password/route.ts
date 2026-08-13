import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { generateVerificationCode, sendVerificationCode } from "@/lib/whatsapp";
import { createPhoneVerificationChallenge, setPhoneVerificationCookie } from "@/lib/auth";
import { checkCooldown } from "@/lib/cooldown";
import { OtpQuotaManager } from "@/services/otp/OtpQuotaManager";

export async function POST(req: NextRequest) {
  try {
    const { phone, forceChannel } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });
    }

    const normalized = normalizeEgyptPhone(String(phone));

    const user = await prisma.user.findFirst({
      where: { phone: normalized, role: "student" },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "لا يوجد حساب طالب مرتبط بهذا الرقم" },
        { status: 404 }
      );
    }

    const bypass = isPhoneVerificationBypassed();

    if (bypass) {
      return NextResponse.json({ success: true, bypass, channel: "dev" });
    }

    // Server-side cooldown validation: 60 seconds per phone number
    const cooldownCheck = checkCooldown(normalized, 60000);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        { error: `يرجى الانتظار ${cooldownCheck.remainingSeconds} ثانية قبل محاولة إرسال الرمز مجدداً.` },
        { status: 429 }
      );
    }

    // Reserve a slot from the daily provider quota before spending it. This
    // path previously skipped OtpQuotaManager entirely, so password-reset
    // traffic could exhaust the WhatsApp allowance with no accounting.
    const quota = await OtpQuotaManager.reserveQuota("PASSWORD_RESET");
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "تم بلوغ الحد اليومي لرسائل التحقق. يرجى المحاولة غداً أو التواصل مع الدعم." },
        { status: 429 }
      );
    }

    // Generate code and send via requested channel (or WhatsApp with SMS fallback)
    const code = generateVerificationCode();
    let result;
    try {
      result = await sendVerificationCode(normalized, code, forceChannel === "sms" ? "sms" : undefined);
    } catch (sendErr) {
      // Give the slot back — a consumed quota with no delivered message is the
      // worst of both outcomes.
      await OtpQuotaManager.releaseQuota("PASSWORD_RESET");
      throw sendErr;
    }

    // Persist the challenge server-side and hand the browser only its id.
    const challengeToken = await createPhoneVerificationChallenge(normalized, code);
    await setPhoneVerificationCookie(challengeToken);

    return NextResponse.json({ success: true, channel: result.channel, bypass });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    );
  }
}
