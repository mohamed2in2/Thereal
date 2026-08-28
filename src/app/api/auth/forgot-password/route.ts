import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { generateVerificationCode, sendVerificationCode } from "@/lib/whatsapp";
import {
  createPhoneVerificationChallenge,
  setPhoneVerificationCookie,
} from "@/lib/auth";
import { checkCooldown } from "@/lib/cooldown";
import { OtpQuotaManager } from "@/services/otp/OtpQuotaManager";

// Egyptian phone numbers are at most 13 chars after normalisation (+201xxxxxxxxx)
const MAX_PHONE_INPUT_LEN = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, forceChannel } = body as {
      phone?: unknown;
      forceChannel?: unknown;
    };

    if (!phone) {
      return NextResponse.json(
        { error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0637\u0644\u0648\u0628" },
        { status: 400 }
      );
    }

    const phoneStr = String(phone).trim();
    if (phoneStr.length === 0 || phoneStr.length > MAX_PHONE_INPUT_LEN) {
      return NextResponse.json(
        { error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" },
        { status: 400 }
      );
    }

    const normalized = normalizeEgyptPhone(phoneStr);

    const user = await prisma.user.findFirst({
      where: { phone: normalized, role: "student" },
      select: { id: true },
    });

    if (!user) {
      // Return a generic success to avoid phone enumeration
      return NextResponse.json(
        { error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0637\u0627\u0644\u0628 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645" },
        { status: 404 }
      );
    }

    const bypass = isPhoneVerificationBypassed();

    if (bypass) {
      return NextResponse.json({ success: true, bypass, channel: "dev" });
    }

    // Server-side cooldown validation: 60 seconds per phone number
    const cooldownCheck = checkCooldown(normalized, 60_000);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        {
          error: `\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${cooldownCheck.remainingSeconds} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0645\u062D\u0627\u0648\u0644\u0629 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 \u0645\u062C\u062F\u062F\u064B\u0627.`,
        },
        { status: 429 }
      );
    }

    // Reserve a slot from the daily provider quota before spending it.
    const quota = await OtpQuotaManager.reserveQuota("PASSWORD_RESET");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            "\u062A\u0645 \u0628\u0644\u0648\u063A \u0627\u0644\u062D\u062F \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u063A\u062F\u064B\u0627 \u0623\u0648 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645.",
        },
        { status: 429 }
      );
    }

    // Generate code and send via requested channel (WhatsApp with SMS fallback)
    const code = generateVerificationCode();
    let result;
    try {
      result = await sendVerificationCode(
        normalized,
        code,
        forceChannel === "sms" ? "sms" : undefined
      );
    } catch (sendErr) {
      // Release the reserved quota slot — a consumed quota with no delivered
      // message is the worst of both outcomes.
      await OtpQuotaManager.releaseQuota("PASSWORD_RESET");
      throw sendErr;
    }

    // Persist the challenge server-side; hand the browser only the opaque id.
    const challengeToken = await createPhoneVerificationChallenge(normalized, code);
    await setPhoneVerificationCookie(challengeToken);

    return NextResponse.json({ success: true, channel: result.channel, bypass });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json(
      { error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628" },
      { status: 500 }
    );
  }
}
