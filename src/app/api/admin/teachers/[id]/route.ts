import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction, LOG_ACTIONS } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";

export async function PATCH(
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
  if (!session || !hasPermission(session.role, "edit_teacher_name")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as { actionPassword?: string; name?: string };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const newName = body.name?.trim() ?? "";
    if (!newName) {
      return NextResponse.json({ error: "الاسم لا يمكن أن يكون فارغاً" }, { status: 400 });
    }

    const teacher = await prisma.user.findFirst({
      where: { id, role: "teacher" },
      select: { id: true, name: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name: newName },
      select: { id: true, name: true },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: LOG_ACTIONS.EDIT_TEACHER_NAME,
      targetType: "teacher",
      targetId: id,
      targetName: teacher.name,
      metadata: { oldName: teacher.name, newName },
    });

    return NextResponse.json({ success: true, teacher: updated });
  } catch (error) {
    console.error("Teacher PATCH error:", error);
    return NextResponse.json({ error: "تعذر تعديل اسم المعلم" }, { status: 500 });
  }
}

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
      action: LOG_ACTIONS.DELETE_TEACHER,
      targetType: "teacher",
      targetId: id,
      targetName: teacher.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Teacher DELETE error:", error);
    return NextResponse.json({ error: "تعذر حذف حساب المعلم" }, { status: 500 });
  }
}