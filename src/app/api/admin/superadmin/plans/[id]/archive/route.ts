import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const plan = await prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
    }

    if (plan.status === "archived") {
      return NextResponse.json({ error: "الخطة مؤرشفة بالفعل" }, { status: 400 });
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: { status: "archived", updatedById: session.id },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "ARCHIVE_PLAN",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Archived plan: ${plan.title} (${plan.id})` },
    });

    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("Failed to archive plan:", error);
    return NextResponse.json({ error: "تعذر أرشفة الخطة" }, { status: 500 });
  }
}
