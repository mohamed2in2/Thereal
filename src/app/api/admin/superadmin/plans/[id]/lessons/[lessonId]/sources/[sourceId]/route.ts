import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string; sourceId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, lessonId, sourceId } = await params;

  try {
    const body = await req.json();
    const { isDefault } = body;

    const source = await prisma.planLessonSource.findFirst({
      where: { id: sourceId, planLessonId: lessonId },
    });

    if (!source) {
      return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404 });
    }

    if (isDefault) {
      // Unset other defaults
      await prisma.planLessonSource.updateMany({
        where: { planLessonId: lessonId, id: { not: sourceId } },
        data: { isDefault: false }
      });
    }

    const updated = await prisma.planLessonSource.update({
      where: { id: sourceId },
      data: { isDefault: isDefault ?? source.isDefault },
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "UPDATE_PLAN_LESSON_SOURCE",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Updated source ${sourceId} in lesson ${lessonId}` },
    });

    return NextResponse.json({ source: updated });
  } catch (error) {
    console.error("Failed to update plan lesson source:", error);
    return NextResponse.json({ error: "تعذر تحديث المصدر" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string; sourceId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId, lessonId, sourceId } = await params;

  try {
    const source = await prisma.planLessonSource.findFirst({
      where: { id: sourceId, planLessonId: lessonId },
    });

    if (!source) {
      return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404 });
    }

    await prisma.planLessonSource.delete({ where: { id: sourceId } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_PLAN_LESSON_SOURCE",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Deleted source ${sourceId} from lesson ${lessonId}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete plan lesson source:", error);
    return NextResponse.json({ error: "تعذر حذف المصدر" }, { status: 500 });
  }
}
