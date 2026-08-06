import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, linkId } = await params;

  try {
    const link = await prisma.planCourseLink.findUnique({
      where: { id: linkId },
    });

    if (!link || link.planId !== planId) {
      return NextResponse.json({ error: "الرابط غير موجود" }, { status: 404 });
    }

    await prisma.planCourseLink.delete({ where: { id: linkId } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_PLAN_COURSE_LINK",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Deleted link ${linkId} from plan ${planId}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete plan course link:", error);
    return NextResponse.json({ error: "تعذر حذف الرابط" }, { status: 500 });
  }
}
