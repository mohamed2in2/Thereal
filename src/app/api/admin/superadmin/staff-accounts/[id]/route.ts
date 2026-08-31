import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAdminAction, LOG_ACTIONS, verifyRoleActionPassword } from "@/lib/admin-auth";
import { invalidateUserSessionCache } from "@/lib/cache";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/superadmin/staff-accounts/[id]
// actions: "toggle_active" | "reset_password"
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
    if (!session || !hasPermission(session.role, "manage_staff_accounts")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      action?: string;
      newPassword?: string;
      actionPassword?: string;
    };

    const { action = "", newPassword = "", actionPassword = "" } = body;

    if (!verifyRoleActionPassword(session.role, actionPassword)) {
      return NextResponse.json({ error: "كلمة مرور الإجراء غير صحيحة" }, { status: 403 });
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { in: ["admin", "staff"] }, isDeleted: false },
    });
    if (!target) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    if (action === "toggle_active") {
      const nowActive = !target.isActive;
      await prisma.user.update({
        where: { id },
        data: {
          isActive: nowActive,
          ...(!nowActive ? { tokenVersion: { increment: 1 } } : {}),
        } as any,
      });
      invalidateUserSessionCache(id);
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: nowActive
          ? LOG_ACTIONS.UNSUSPEND_STAFF_ACCOUNT
          : LOG_ACTIONS.SUSPEND_STAFF_ACCOUNT,
        targetType: "StaffAccount",
        targetId: id,
        targetName: target.name,
        metadata: { role: target.role, isActive: nowActive },
      });
      return NextResponse.json({ isActive: nowActive });
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
      }
      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id },
        data: {
          password: hashed,
          tokenVersion: { increment: 1 },
        } as any,
      });
      invalidateUserSessionCache(id);
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: LOG_ACTIONS.RESET_STAFF_PASSWORD,
        targetType: "StaffAccount",
        targetId: id,
        targetName: target.name,
        metadata: { role: target.role },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err) {
    console.error("PATCH staff-accounts/[id] error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

// DELETE /api/admin/superadmin/staff-accounts/[id] — soft delete
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
    if (!session || !hasPermission(session.role, "manage_staff_accounts")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const { actionPassword = "" } = (await req.json()) as { actionPassword?: string };

    if (!verifyRoleActionPassword(session.role, actionPassword)) {
      return NextResponse.json({ error: "كلمة مرور الإجراء غير صحيحة" }, { status: 403 });
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { in: ["admin", "staff"] }, isDeleted: false },
    });
    if (!target) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        tokenVersion: { increment: 1 },
      } as any,
    });
    invalidateUserSessionCache(id);

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: LOG_ACTIONS.DELETE_STAFF_ACCOUNT,
      targetType: "StaffAccount",
      targetId: id,
      targetName: target.name,
      metadata: { role: target.role, email: target.email },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE staff-accounts/[id] error:", err);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
