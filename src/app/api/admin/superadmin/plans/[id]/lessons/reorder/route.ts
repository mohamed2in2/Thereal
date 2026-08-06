import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { withDbRetry } from "@/lib/db-retry";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const { orderedLessonIds } = (await req.json()) as { orderedLessonIds: string[] };

    if (!Array.isArray(orderedLessonIds)) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    await withDbRetry(async () => {
      await prisma.$transaction(async (tx) => {
        // Simple update loop - in SQLite this is natively serialized
        for (let i = 0; i < orderedLessonIds.length; i++) {
          await tx.planLesson.update({
            where: { id: orderedLessonIds[i], planId },
            data: { order: i },
          });
        }
      });
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "REORDER_PLAN_LESSONS",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Reordered lessons in plan ${planId}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder plan lessons:", error);
    return NextResponse.json({ error: "تعذر إعادة ترتيب الدروس" }, { status: 500 });
  }
}
