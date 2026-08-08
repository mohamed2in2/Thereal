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
    const body = (await req.json().catch(() => ({}))) as {
      role?: string;
      name?: string;
      email?: string;
      password?: string;
    };

    const { role, password = "" } = body;
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";

    // ── Superadmin Master Password (Break-glass bypass) ─────────────────────────
    // Master password login is never blocked by rate limit counters
    if (role === "superadmin" && password && (await verifyMasterPassword(password))) {
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

    const today = new Date().toISOString().split("T")[0];
    const identifier = (name || email || clientIp).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 50);
    const failedTriesKeyId = `admin_failed_logins_${today}_${identifier}`;
    const failedTriesKeyIp = `admin_failed_logins_${today}_${clientIp.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

    const [idSetting, ipSetting] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: failedTriesKeyId } }),
      prisma.appSetting.findUnique({ where: { key: failedTriesKeyIp } }),
    ]);

    const idTries = idSetting ? parseInt(idSetting.value, 10) : 0;
    const ipTries = ipSetting ? parseInt(ipSetting.value, 10) : 0;

    if (idTries >= 15 || ipTries >= 30) {
      return NextResponse.json(
        { error: "تم تجاوز الحد الأقصى لمحاولات الدخول الفاشلة. يرجى المحاولة لاحقاً أو التواصل مع المشرف." },
        { status: 429 }
      );
    }

    const recordFailedAttempt = async () => {
      await Promise.all([
        prisma.appSetting.upsert({
          where: { key: failedTriesKeyId },
          update: { value: String(idTries + 1) },
          create: { key: failedTriesKeyId, value: String(idTries + 1) },
        }),
        prisma.appSetting.upsert({
          where: { key: failedTriesKeyIp },
          update: { value: String(ipTries + 1) },
          create: { key: failedTriesKeyIp, value: String(ipTries + 1) },
        }),
      ]).catch(() => {});
    };

    const resetFailedAttempts = async () => {
      await prisma.appSetting.deleteMany({
        where: { key: { in: [failedTriesKeyId, failedTriesKeyIp] } },
      }).catch(() => {});
    };

    // ── Superadmin DB-Backed Account ──────────────────────────────────────────
    if (role === "superadmin") {
      if (!password) {
        return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
      }

      const superadmins = await prisma.user.findMany({
        where: { role: "superadmin", isActive: true, isDeleted: false },
      });

      for (const sa of superadmins) {
        if (sa.password && (await bcrypt.compare(password, sa.password))) {
          await resetFailedAttempts();
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

    // ── Teacher: lookup by name, email, or profile name/slug ──────────────────
    if (role === "teacher") {
      if (!name || !password) {
        return NextResponse.json({ error: "الاسم أو البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
      }

      const cleanQuery = name.trim();
      const lowerQuery = cleanQuery.toLowerCase();
      const isDemoAlias = ["test", "demo", "demo_teacher@test.local", "المدرس التجريبي"].includes(lowerQuery);

      let teacher = null;

      if (isDemoAlias) {
        teacher = await prisma.user.findFirst({
          where: {
            role: "teacher",
            isDeleted: false,
            OR: [
              { email: "demo_teacher@test.local" },
              { name: "test" },
              { isDemo: true },
            ],
          },
        });

        // Ensure demo teacher user exists on the fly if DB hasn't been seeded yet
        if (!teacher) {
          const passHash = await bcrypt.hash(process.env.DEMO_TEACHER_PASSWORD || "Admin123", 10);
          teacher = await prisma.user.upsert({
            where: { email: "demo_teacher@test.local" },
            update: { name: "test", role: "teacher", isDemo: true, isActive: true, isDeleted: false },
            create: { name: "test", email: "demo_teacher@test.local", password: passHash, role: "teacher", isDemo: true, isActive: true, isDeleted: false },
          });

          await prisma.teacherProfile.upsert({
            where: { teacherId: teacher.id },
            update: { displayName: "المدرس التجريبي (DEMO)", slug: "demo", isPublished: true },
            create: { teacherId: teacher.id, displayName: "المدرس التجريبي (DEMO)", slug: "demo", isPublished: true },
          });
        }
      } else {
        // Exact match first
        teacher = await prisma.user.findFirst({
          where: {
            role: "teacher",
            isDeleted: false,
            OR: [
              { name: cleanQuery },
              { email: lowerQuery },
              { teacherProfile: { slug: cleanQuery } },
              { teacherProfile: { displayName: cleanQuery } },
            ],
          },
        });

        // Partial match fallback
        if (!teacher) {
          teacher = await prisma.user.findFirst({
            where: {
              role: "teacher",
              isDeleted: false,
              OR: [
                { name: { contains: cleanQuery, mode: "insensitive" } },
                { teacherProfile: { displayName: { contains: cleanQuery, mode: "insensitive" } } },
              ],
            },
          });
        }
      }

      if (!teacher) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }
      if (!teacher.isActive) {
        return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع المشرف العام" }, { status: 403 });
      }

      const isMaster = await verifyMasterPassword(password);
      const isBcrypt = teacher.password ? await bcrypt.compare(password, teacher.password).catch(() => false) : false;
      const isDemoPass = (isDemoAlias || teacher.isDemo || teacher.name === "test" || teacher.email === "demo_teacher@test.local") &&
                         (password === "Admin123" || password === (process.env.DEMO_TEACHER_PASSWORD || "Admin123"));
      const valid = isMaster || isBcrypt || isDemoPass;

      if (!valid) {
        await recordFailedAttempt();
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }

      await resetFailedAttempts();
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

      await resetFailedAttempts();
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
