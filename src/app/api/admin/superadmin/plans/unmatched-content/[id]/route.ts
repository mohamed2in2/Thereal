import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { dismiss, assignToLessonId } = body;

    const item = await prisma.unmatchedPlanContent.findUnique({
      where: { id }
    });

    if (!item) {
      return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
    }

    if (dismiss) {
      const updated = await prisma.unmatchedPlanContent.update({
        where: { id },
        data: { resolvedAt: new Date() }
      });
      return NextResponse.json({ item: updated });
    }

    if (assignToLessonId) {
      // Validate lesson exists
      const lesson = await prisma.planLesson.findUnique({ where: { id: assignToLessonId } });
      if (!lesson) {
        return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
      }

      // Add as source
      await prisma.planLessonSource.create({
        data: {
          planLessonId: assignToLessonId,
          videoId: item.videoId,
          teacherId: item.teacherId,
          isDefault: false,
          isManual: true,
        }
      });

      // Mark resolved
      const updated = await prisma.unmatchedPlanContent.update({
        where: { id },
        data: { resolvedAt: new Date() }
      });

      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: "RESOLVE_UNMATCHED_CONTENT",
        targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Assigned video ${item.videoId} to lesson ${assignToLessonId}` },
      });

      return NextResponse.json({ item: updated });
    }

    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update unmatched content:", error);
    return NextResponse.json({ error: "تعذر تحديث العنصر" }, { status: 500 });
  }
}
