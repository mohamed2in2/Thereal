import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { isPhoneVerificationBypassed } from "@/lib/aws-sms";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { normalizeEgyptPhone } from "@/lib/phone";
import { getConfigNumberClamped } from "./config";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Please configure it in your .env file.");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const AUTH_COOKIE_NAME = "auth_token";
const PHONE_VERIFY_COOKIE_NAME = "student_phone_verify";

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  accountMode?: string;
  /** True for the owner superadmin (Ahmed) and the break-glass master login. */
  isOwner?: boolean;
  deviceId?: string;
  iat?: number;
  exp?: number;
}

export interface SessionUser {
  id: string;
  clerkId?: string;
  email: string;
  name: string;
  role: string;
  accountMode?: string;
  isOwner?: boolean;
  profileCompleted: boolean;
  phone?: string | null;
  parentPhone?: string | null;
  age?: number | null;
  educationalStage?: string | null;
  createdAt?: Date;
  deviceId?: string;
  referralCode?: string | null;
  streakFreezes?: number;
  balance?: number;
}

type PhoneChallengePayload = {
  phone: string;
  codeHash?: string;
  method?: string;
  iat?: number;
  exp?: number;
};

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">) {
  const days = await getConfigNumberClamped("jwt_expiry_days", 1, 365); // was 7d; never 0/NaN
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  const days = await getConfigNumberClamped("jwt_expiry_days", 1, 365); // matches the JWT expiry
  const isSecure = process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES === "true";
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * days,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

function hashVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function createPhoneVerificationChallenge(phone: string, code?: string, method?: string) {
  const payload: Record<string, unknown> = { phone };
  if (code) payload.codeHash = hashVerificationCode(code);
  if (method) payload.method = method;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("3m")
    .sign(JWT_SECRET);
}

export async function setPhoneVerificationCookie(token: string) {
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES === "true";
  cookieStore.set(PHONE_VERIFY_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    maxAge: 60 * 3,
    path: "/",
  });
}

export async function clearPhoneVerificationCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PHONE_VERIFY_COOKIE_NAME);
}

export async function verifyPhoneVerificationCookie(phone: string, code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PHONE_VERIFY_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const challenge = payload as unknown as PhoneChallengePayload;
    if (!challenge?.phone) return false;
    const normalizedPhone = normalizeEgyptPhone(String(phone));
    if (challenge.phone !== normalizedPhone) return false;

    if (isPhoneVerificationBypassed()) {
      return true;
    }

    if (!challenge.codeHash) return false;
    const codeHash = hashVerificationCode(code.trim());
    return challenge.codeHash === codeHash;
  } catch {
    return false;
  }
}

async function getJwtSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  if (payload.role === "superadmin") {
    // Break-glass: env master-password login carries id "superadmin", no DB row.
    if (payload.id === "superadmin") {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        isOwner: true,
        profileCompleted: true,
        deviceId: payload.deviceId,
      };
    }
    // Named DB-backed superadmin — re-validate against the row so a
    // renamed/suspended/deleted account reflects immediately.
    const sa = await prisma.user.findFirst({
      where: { id: payload.id, role: "superadmin", isDeleted: false },
    });
    if (!sa || !sa.isActive) return null;
    return {
      id: sa.id,
      email: sa.email,
      name: sa.name,
      role: "superadmin",
      isOwner: sa.isOwner,
      profileCompleted: true,
      deviceId: payload.deviceId,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
  });

  if (!user || !user.isActive || user.isDeleted) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    accountMode: user.accountMode || "NORMAL",
    profileCompleted: user.profileCompleted,
    phone: user.phone,
    parentPhone: user.parentPhone,
    age: user.age,
    educationalStage: user.educationalStage,
    createdAt: user.createdAt,
    deviceId: payload.deviceId,
    referralCode: user.referralCode,
    streakFreezes: user.streakFreezes,
    balance: user.balance ?? 0,
  };
}

type SessionOptions = {
  preferStudent?: boolean;
};

function isStudentRole(role: string) {
  return role === "student";
}

export async function getSession(options?: SessionOptions): Promise<SessionUser | null> {
  const session = await getJwtSession();

  if (!session) {
    return null;
  }

  if (options?.preferStudent && !isStudentRole(session.role)) {
    return null;
  }

  return session;
}

export async function getStudentSession(): Promise<SessionUser | null> {
  return getSession({ preferStudent: true });
}

export async function getSessionWithRetry(
  maxRetries = 3,
  delayMs = 100,
  options?: SessionOptions
): Promise<SessionUser | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const session = await getSession(options);
    if (session) {
      return session;
    }
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  return null;
}

export async function getStudentSessionWithRetry(maxRetries = 3, delayMs = 80): Promise<SessionUser | null> {
  return getSessionWithRetry(maxRetries, delayMs, { preferStudent: true });
}

export async function markProfileCompleted(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { profileCompleted: true },
  });
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    parentPhone?: string;
    age?: number;
    educationalStage?: string;
  }
) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
