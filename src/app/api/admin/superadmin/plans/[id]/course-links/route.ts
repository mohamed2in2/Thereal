import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { triggerPlanSyncForCourse } from "@/lib/plan-lesson-matcher";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const links = await prisma.planCourseLink.findMany({
      where: { planId },
      include: {
        course: {
          select: { id: true, title: true, teacherId: true, teacher: { select: { name: true } } }
        }
      }
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Failed to fetch plan course links:", error);
    return NextResponse.json({ error: "تعذر جلب روابط الدورات" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const body = await req.json();
    const { courseId, folderId, startIndex, endIndex } = body;

    if (!courseId) {
      return NextResponse.json({ error: "الدورة مطلوبة" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 });
    }

    // A course folder combo must be unique per plan
    const existing = await prisma.planCourseLink.findFirst({
      where: { planId, courseId, folderId: folderId ?? null }
    });

    if (existing) {
      return NextResponse.json({ error: "هذه الدورة مرتبطة مسبقاً بهذه الخطة" }, { status: 400 });
    }

    const link = await prisma.planCourseLink.create({
      data: {
        planId,
        courseId,
        folderId: folderId ?? null,
        startIndex: typeof startIndex === "number" ? startIndex : null,
        endIndex: typeof endIndex === "number" ? endIndex : null,
      }
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "CREATE_PLAN_COURSE_LINK",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Linked course ${courseId} to plan ${planId}` },
    });

    // Fire and forget auto-sync
    triggerPlanSyncForCourse(courseId).catch(console.error);

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("Failed to create plan course link:", error);
    return NextResponse.json({ error: "تعذر ربط الدورة" }, { status: 500 });
  }
}
