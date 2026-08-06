import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";

async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "superadmin" || !session.isOwner) return null;
  return session;
}

/** Rename / reset password / suspend a superadmin. Owner only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      password?: string;
      clearPassword?: boolean;
      isActive?: boolean;
      actionPassword?: string;
    };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    const target = await prisma.user.findFirst({
      where: { id, role: "superadmin", isDeleted: false },
      select: { id: true, name: true, isOwner: true },
    });
    if (!target) {
      return NextResponse.json({ error: "المشرف غير موجود" }, { status: 404 });
    }
    // The owner account cannot be suspended (lockout guard); its name/password
    // can still be changed.
    if (target.isOwner && body.isActive === false) {
      return NextResponse.json({ error: "لا يمكن إيقاف حساب المالك" }, { status: 400 });
    }
    // The owner's password cannot be cleared — lockout guard.
    if (target.isOwner && body.clearPassword) {
      return NextResponse.json({ error: "لا يمكن حذف كلمة مرور حساب المالك" }, { status: 400 });
    }

    const data: { name?: string; password?: string | null; isActive?: boolean } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.clearPassword) {
      // Nullify the password — blocks password-based login for this account.
      data.password = null;
    } else if (typeof body.password === "string" && body.password) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "كلمة المرور قصيرة جداً (٦ أحرف على الأقل)" }, { status: 400 });
      }
      data.password = await bcrypt.hash(body.password, 12);
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا يوجد تغيير" }, { status: 400 });
    }

    await prisma.user.update({ where: { id }, data });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "EDIT_SUPERADMIN",
      targetType: "superadmin",
      targetId: id,
      targetName: target.name,
      metadata: {
        renamed: !!data.name,
        passwordChanged: !!data.password,
        ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Superadmin PATCH error:", error);
    return NextResponse.json({ error: "تعذر تعديل المشرف" }, { status: 500 });
  }
}

/** Delete a superadmin. Owner only; the owner account itself is protected. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { actionPassword?: string };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    const target = await prisma.user.findFirst({
      where: { id, role: "superadmin", isDeleted: false },
      select: { id: true, name: true, isOwner: true },
    });
    if (!target) {
      return NextResponse.json({ error: "المشرف غير موجود" }, { status: 404 });
    }
    if (target.isOwner) {
      return NextResponse.json({ error: "لا يمكن حذف حساب المالك" }, { status: 400 });
    }
    if (id === session.id) {
      return NextResponse.json({ error: "لا يمكنك حذف حسابك" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_SUPERADMIN",
      targetType: "superadmin",
      targetId: id,
      targetName: target.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Superadmin DELETE error:", error);
    return NextResponse.json({ error: "تعذر حذف المشرف" }, { status: 500 });
  }
}
