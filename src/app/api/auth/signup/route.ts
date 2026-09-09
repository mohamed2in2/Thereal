import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  clearPhoneVerificationCookie,
  setAuthCookie,
  signToken,
  verifyPhoneVerificationCookie,
} from "@/lib/auth";
import { normalizeEgyptPhone } from "@/lib/phone";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { maybeAutoSendParentPortalLink } from "@/lib/whatsapp/parentToken";

const MAX_NAME_LEN = 100;
const MAX_PASSWORD_LEN = 128;
const MIN_PASSWORD_LEN = 6;

function normalizeStage(value: string) {
  return value.trim();
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name,
      password,
      phone,
      parentPhone,
      age,
      educationalStage,
      verificationCode,
      referralCode,
      promoCode,
      teacherPromoCode,
    } = body as Record<string, unknown>;

    if (!name || !password || !phone || !parentPhone || !age || !educationalStage) {
      return NextResponse.json(
        { error: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629" },
        { status: 400 }
      );
    }

    const nameStr = String(name).trim();
    const passwordStr = String(password);

    if (nameStr.length < 2 || nameStr.length > MAX_NAME_LEN) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0627\u0633\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u064A\u0646 2 \u0648 100 \u062D\u0631\u0641" },
        { status: 400 }
      );
    }
    if (passwordStr.length < MIN_PASSWORD_LEN || passwordStr.length > MAX_PASSWORD_LEN) {
      return NextResponse.json(
        { error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0628\u064A\u0646 6 \u0648 128 \u062D\u0631\u0641" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptPhone(String(phone));
    const normalizedParentPhone = normalizeEgyptPhone(String(parentPhone));

    if (normalizedPhone === normalizedParentPhone) {
      return NextResponse.json(
        { error: "\u0631\u0642\u0645 \u0627\u0644\u0645\u062A\u0639\u0644\u0645 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0633\u0627\u0648\u064A \u0631\u0642\u0645 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631" },
        { status: 400 }
      );
    }

    if (!isPhoneVerificationBypassed()) {
      if (!verificationCode) {
        return NextResponse.json(
          { error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0637\u0644\u0648\u0628" },
          { status: 400 }
        );
      }
      const isValid = await verifyPhoneVerificationCookie(
        normalizedPhone,
        String(verificationCode)
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" },
          { status: 400 }
        );
      }
    }

    const generatedEmail = `${normalizedPhone.replace("+", "")}@students.code-up.tech`;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: generatedEmail }, { phone: normalizedPhone }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(passwordStr, 12);
    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge < 6 || parsedAge > 25) {
      return NextResponse.json(
        { error: "\u0627\u0644\u0639\u0645\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" },
        { status: 400 }
      );
    }

    const promoCodeInput = promoCode || teacherPromoCode || (body as Record<string, unknown>).promo_code;
    let referredByTeacherId: string | undefined;
    let promoCodeUsed: string | undefined;

    if (promoCodeInput && String(promoCodeInput).trim().length > 0) {
      const codeUpper = String(promoCodeInput).trim().toUpperCase();
      const teacher = await prisma.user.findFirst({
        where: {
          role: "teacher",
          promoProgramEnabled: true,
          promoCode: codeUpper,
          isDeleted: false,
        },
        select: { id: true, promoCodeCreatedAt: true },
      });
      if (teacher && teacher.promoCodeCreatedAt) {
        const expiryDate = new Date(
          teacher.promoCodeCreatedAt.getTime() + 350 * 24 * 60 * 60 * 1000
        );
        if (new Date() <= expiryDate) {
          referredByTeacherId = teacher.id;
          promoCodeUsed = codeUpper;
        }
      }
    }

    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: String(referralCode).trim().toUpperCase() },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

    // Generate unique referral code (max 20 attempts to avoid unbounded loop)
    let newReferralCode = generateReferralCode();
    for (let i = 0; i < 20; i++) {
      const clash = await prisma.user.findUnique({
        where: { referralCode: newReferralCode },
        select: { id: true },
      });
      if (!clash) break;
      newReferralCode = generateReferralCode();
    }

    const user = await prisma.user.create({
      data: {
        name: nameStr,
        email: generatedEmail,
        password: hashed,
        phone: normalizedPhone,
        parentPhone: normalizedParentPhone,
        age: parsedAge,
        educationalStage: normalizeStage(String(educationalStage)),
        role: "student",
        profileCompleted: true,
        referralCode: newReferralCode,
        referredById,
        referredByTeacherId,
      },
    });

    maybeAutoSendParentPortalLink(user.id).catch((err) => {
      console.error("Auto-send parent portal link error on signup:", err);
    });

    if (referredByTeacherId) {
      await prisma.teacherReferralAttribution
        .create({
          data: {
            teacherId: referredByTeacherId,
            studentId: user.id,
            purchaseType: "SIGNUP",
            amount: 0,
            promoCodeUsed,
          },
        })
        .catch(() => {});
    }

    if (referredById) {
      const { ReferralService } = await import("@/services/referral/ReferralService");
      await ReferralService.registerPendingReferral(referredById, user.id);
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await setAuthCookie(token);
    await clearPhoneVerificationCookie();

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          phone: user.phone,
          age: user.age,
          educationalStage: user.educationalStage,
          profileCompleted: user.profileCompleted,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" },
      { status: 500 }
    );
  }
}
