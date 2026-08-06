import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyRoleActionPassword, logAdminAction, LOG_ACTIONS } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";

export async function POST(
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
  if (!session || !hasPermission(session.role, "restore_student")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as { actionPassword?: string };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const student = await prisma.user.findFirst({
      where: { id, role: "student", isDeleted: true },
      select: { id: true, name: true },
    });

    if (!student) {
      return NextResponse.json({ error: "المتعلم غير موجود في سلة المحذوفات" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, isActive: true },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: LOG_ACTIONS.RESTORE_STUDENT,
      targetType: "student",
      targetId: id,
      targetName: student.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore student error:", error);
    return NextResponse.json({ error: "تعذر استعادة حساب المتعلم" }, { status: 500 });
  }
}
