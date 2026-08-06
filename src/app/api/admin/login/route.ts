import { getSession } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyMasterPassword } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    const __logSession = await getSession();
    if (__logSession && __logSession.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: __logSession.id,
          adminName: __logSession.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }

  try {
    const today = new Date().toISOString().split("T")[0];
    const failedTriesKey = `admin_failed_logins_${today}`;

    const currentTriesSetting = await prisma.appSetting.findUnique({
      where: { key: failedTriesKey },
    });
    const currentTries = currentTriesSetting ? parseInt(currentTriesSetting.value, 10) : 0;

    if (currentTries >= 30) {
      return NextResponse.json(
        { error: "تم تجاوز الحد الأقصى لمحاولات الدخول الفاشلة اليوم" },
        { status: 429 }
      );
    }

    const recordFailedAttempt = async () => {
      const newTries = currentTries + 1;
      await prisma.appSetting.upsert({
        where: { key: failedTriesKey },
        update: { value: String(newTries) },
        create: { key: failedTriesKey, value: String(newTries) },
      });
    };

    const body = (await req.json()) as {
      role?: string;
      name?: string;
      email?: string;
      password?: string;
    };

    const { role, password = "" } = body;
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";

    // ── Superadmin ────────────────────────────────────────────────────────────
    // Two ways in (password-only form, so we match by password):
    //   1. Break-glass: the env master password → owner-level session (no DB row).
    //   2. A named DB-backed superadmin whose bcrypt password matches.
    if (role === "superadmin") {
      if (!password) {
        return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
      }

      // 1) Break-glass owner login — DB-set master password (or env fallback).
      if (await verifyMasterPassword(password)) {
        const token = await signToken({
          id: "superadmin",
          email: "superadmin@system",
          name: "المشرف العام",
          role: "superadmin",
          isOwner: true,
        });
        await setAuthCookie(token);
        return NextResponse.json({ user: { id: "superadmin", name: "المشرف العام", role: "superadmin", isOwner: true } });
      }

      // 2) Named superadmin — match the password against each active account.
      const superadmins = await prisma.user.findMany({
        where: { role: "superadmin", isActive: true, isDeleted: false },
      });
      for (const sa of superadmins) {
        if (sa.password && (await bcrypt.compare(password, sa.password))) {
          const token = await signToken({
            id: sa.id,
            email: sa.email,
            name: sa.name,
            role: "superadmin",
            isOwner: sa.isOwner,
          });
          await setAuthCookie(token);
          return NextResponse.json({ user: { id: sa.id, name: sa.name, role: "superadmin", isOwner: sa.isOwner } });
        }
      }

      await recordFailedAttempt();
      return NextResponse.json({ error: "كلمة المرور الرئيسية غير صحيحة" }, { status: 401 });
    }

    // ── Teacher: lookup by name, bcrypt verify ────────────────────────────────
    if (role === "teacher") {
      if (!name || !password) {
        return NextResponse.json({ error: "الاسم وكلمة المرور مطلوبان" }, { status: 400 });
      }
      const teacher = await prisma.user.findFirst({
        where: { name, role: "teacher", isDeleted: false },
      });
      if (!teacher || !teacher.password) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }
      if (!teacher.isActive) {
        return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع المشرف العام" }, { status: 403 });
      }
      const valid = await bcrypt.compare(password, teacher.password);
      if (!valid) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }
      const token = await signToken({
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        role: "teacher",
      });
      await setAuthCookie(token);
      return NextResponse.json({ user: { id: teacher.id, name: teacher.name, role: "teacher" } });
    }

    // ── Admin / Staff: lookup by email, bcrypt verify ─────────────────────────
    // Frontend sends role="staff_portal" for both admin and staff accounts.
    // The actual role stored in the DB (admin | staff) is returned in the response.
    if (role === "staff_portal") {
      if (!email || !password) {
        return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
      }
      const user = await prisma.user.findFirst({
        where: {
          email,
          role: { in: ["admin", "staff"] },
          isDeleted: false,
        },
      });
      if (!user || !user.password) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }
      if (!user.isActive) {
        return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع المشرف العام" }, { status: 403 });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }
      const token = await signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      await setAuthCookie(token);
      return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
    }

    return NextResponse.json({ error: "دور غير صحيح" }, { status: 400 });
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
