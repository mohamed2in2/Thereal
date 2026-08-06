import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCourseToPlan } from "@/lib/plan-lesson-matcher";

export async function POST(
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

    await syncCourseToPlan(planId, link.courseId);

    return NextResponse.json({ success: true, message: "تم تحديث مزامنة الدورة بنجاح" });
  } catch (error) {
    console.error("Failed to resync plan course link:", error);
    return NextResponse.json({ error: "تعذر مزامنة الدورة" }, { status: 500 });
  }
}
