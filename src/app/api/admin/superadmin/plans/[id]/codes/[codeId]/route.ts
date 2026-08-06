import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; codeId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, codeId } = await params;

  try {
    const body = await req.json();
    const { isActive } = body;

    const code = await prisma.planAccessCode.findFirst({
      where: { id: codeId, planId },
    });

    if (!code) {
      return NextResponse.json({ error: "الكود غير موجود" }, { status: 404 });
    }

    if (isActive === true && !!code.usedAt) {
      return NextResponse.json({ error: "لا يمكن إعادة تفعيل كود تم استخدامه" }, { status: 400 });
    }

    const updated = await prisma.planAccessCode.update({
      where: { id: codeId },
      data: { isActive },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "UPDATE_PLAN_CODE",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Updated plan access code ${codeId} isActive=${isActive}` },
    });

    return NextResponse.json({ code: updated });
  } catch (error) {
    console.error("Failed to update plan access code:", error);
    return NextResponse.json({ error: "تعذر تحديث الكود" }, { status: 500 });
  }
}
