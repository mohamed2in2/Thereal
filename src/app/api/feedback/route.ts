import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST — student submits feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { courseId, type, content, rating } = await req.json();
    if (!courseId || !content || !type) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
    }

    // Check student has access to this course
    const access = await prisma.accessCode.findFirst({
      where: { courseId, studentId: session.id },
    });
    if (!access) {
      return NextResponse.json(
        { error: "يجب أن تكون مسجلاً في الكورس لتقديم ملاحظات" },
        { status: 403 }
      );
    }

    const feedback = await prisma.studentFeedback.create({
      data: {
        studentId: session.id,
        courseId,
        teacherId: course.teacherId,
        type,
        content,
        rating: rating ?? null,
      },
    });

    return NextResponse.json({ feedback, message: "تم إرسال ملاحظتك بنجاح" });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// GET — list student's own feedback
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const courseId = req.nextUrl.searchParams.get("courseId");

    const feedback = await prisma.studentFeedback.findMany({
      where: {
        studentId: session.id,
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { title: true } },
        teacher: { select: { name: true } },
      },
    });

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
