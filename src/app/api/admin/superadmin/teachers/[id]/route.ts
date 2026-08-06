import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction, LOG_ACTIONS } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";

/**
 * PATCH /api/admin/superadmin/teachers/[id]
 * Updates teacher fields (e.g. promoProgramEnabled, name).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "owner")) {
      return NextResponse.json({ error: "غير مصرح — للمشرفين فقط" }, { status: 403 });
    }

    const { id: teacherId } = await params;
    const body = (await req.json().catch(() => ({}))) as { promoProgramEnabled?: boolean; name?: string };

    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, role: "teacher" },
      select: { id: true, name: true, promoProgramEnabled: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 });
    }

    const updateData: { promoProgramEnabled?: boolean; name?: string } = {};
    if (typeof body.promoProgramEnabled === "boolean") {
      updateData.promoProgramEnabled = body.promoProgramEnabled;
    }
    if (body.name && body.name.trim()) {
      updateData.name = body.name.trim();
    }

    const updated = await prisma.user.update({
      where: { id: teacherId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        promoProgramEnabled: true,
        promoCode: true,
        promoCodeCreatedAt: true,
      },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "TOGGLE_TEACHER_PROMO_PROGRAM",
      targetType: "teacher",
      targetId: teacherId,
      targetName: teacher.name,
      metadata: { previous: teacher.promoProgramEnabled, updated: updated.promoProgramEnabled },
    });

    return NextResponse.json({ success: true, teacher: updated });
  } catch (error) {
    console.error("Superadmin teacher PATCH error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث حساب المعلم" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/superadmin/teachers/[id]
 * Permanent deletion (skips the grace period) of a soft-deleted teacher.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!session || !hasPermission(session.role, "delete_teacher")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { actionPassword?: string };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const teacher = await prisma.user.findFirst({
      where: { id, role: "teacher" },
      select: { id: true, name: true },
    });
    if (!teacher) {
      return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 });
    }

    await prisma.course.deleteMany({ where: { teacherId: id } });
    await prisma.user.delete({ where: { id } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: LOG_ACTIONS.HARD_DELETE_TEACHER,
      targetType: "teacher",
      targetId: id,
      targetName: teacher.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Hard delete teacher error:", error);
    return NextResponse.json({ error: "تعذر الحذف النهائي للمعلم" }, { status: 500 });
  }
}
