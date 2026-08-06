import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction, LOG_ACTIONS } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      where: { id, role: "teacher", isDeleted: true },
      select: { id: true, name: true },
    });
    if (!teacher) {
      return NextResponse.json({ error: "المعلم غير موجود في سلة المحذوفات" }, { status: 404 });
    }

    // Restore the teacher + all his content becomes visible again automatically
    // (the isDeleted filters stop hiding it).
    await prisma.user.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, isActive: true },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: LOG_ACTIONS.RESTORE_TEACHER,
      targetType: "teacher",
      targetId: id,
      targetName: teacher.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore teacher error:", error);
    return NextResponse.json({ error: "تعذر استعادة حساب المعلم" }, { status: 500 });
  }
}
