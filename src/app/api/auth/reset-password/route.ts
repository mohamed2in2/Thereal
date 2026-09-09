import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import {
  clearPhoneVerificationCookie,
  verifyPhoneVerificationCookie,
} from "@/lib/auth";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { invalidateUserSessionCache } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, verificationCode, newPassword } = body as {
      phone?: unknown;
      verificationCode?: unknown;
      newPassword?: unknown;
    };

    if (!phone || !newPassword) {
      return NextResponse.json(
        { error: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629" },
        { status: 400 }
      );
    }

    const passwordStr = String(newPassword);
    if (passwordStr.length < 6 || passwordStr.length > 128) {
      return NextResponse.json(
        { error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0628\u064A\u0646 6 \u0648 128 \u062D\u0631\u0641\u064B\u0627" },
        { status: 400 }
      );
    }

    const normalized = normalizeEgyptPhone(String(phone));

    if (!isPhoneVerificationBypassed()) {
      if (!verificationCode) {
        return NextResponse.json(
          { error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0637\u0644\u0648\u0628" },
          { status: 400 }
        );
      }
      const isValid = await verifyPhoneVerificationCookie(
        normalized,
        String(verificationCode)
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "\u0627\u0644\u0643\u0648\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647" },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.findFirst({
      where: { phone: normalized, role: "student" },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645" },
        { status: 404 }
      );
    }

    // Use bcrypt cost 12 (consistent with signup)
    const hashed = await bcrypt.hash(passwordStr, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      } as Parameters<typeof prisma.user.update>[0]["data"],
    });
    invalidateUserSessionCache(user.id);

    await clearPhoneVerificationCookie();

    return NextResponse.json({ message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json(
      { error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" },
      { status: 500 }
    );
  }
}
