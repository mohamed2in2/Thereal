import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list feedback for teacher's courses
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const unresolvedOnly = req.nextUrl.searchParams.get("unresolved") === "true";

    const feedback = await prisma.studentFeedback.findMany({
      where: {
        teacherId: session.id,
        ...(unresolvedOnly ? { isResolved: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { name: true, phone: true, educationalStage: true } },
        course: { select: { title: true } },
      },
    });

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("Teacher feedback GET error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// PATCH — mark feedback as resolved
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id, resolution, isResolved } = await req.json();
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    const fb = await prisma.studentFeedback.findUnique({ where: { id } });
    if (!fb || fb.teacherId !== session.id) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const updated = await prisma.studentFeedback.update({
      where: { id },
      data: {
        ...(resolution ? { resolution } : {}),
        ...(typeof isResolved === "boolean" ? { isResolved } : {}),
      },
    });

    return NextResponse.json({ feedback: updated });
  } catch (err) {
    console.error("Teacher feedback PATCH error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
