import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";

/** Only the owner superadmin (Ahmed) may manage superadmins. */
async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "superadmin" || !session.isOwner) return null;
  return session;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const superadmins = await prisma.user.findMany({
      where: { role: "superadmin", isDeleted: false },
      select: { id: true, name: true, email: true, isOwner: true, isActive: true, createdAt: true },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ superadmins, selfId: session.id });
  } catch (error) {
    // isOwner column not migrated yet → empty list instead of a 500.
    console.error("Superadmins list error:", error);
    return NextResponse.json({ superadmins: [], selfId: session.id });
  }
}

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

  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
      actionPassword?: string;
    };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!name || !email || password.length < 6) {
      return NextResponse.json({ error: "الاسم والبريد وكلمة مرور (٦ أحرف+) مطلوبة" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    }

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 12),
        role: "superadmin",
        isOwner: false,
        isActive: true,
        profileCompleted: true,
      },
      select: { id: true, name: true, email: true, isOwner: true, isActive: true },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "CREATE_SUPERADMIN",
      targetType: "superadmin",
      targetId: created.id,
      targetName: created.name,
    });

    return NextResponse.json({ success: true, superadmin: created });
  } catch (error) {
    console.error("Superadmin create error:", error);
    return NextResponse.json({ error: "تعذر إنشاء المشرف" }, { status: 500 });
  }
}
