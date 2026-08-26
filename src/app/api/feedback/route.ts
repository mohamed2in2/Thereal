import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_FEEDBACK_TYPES = ["general", "content", "technical", "suggestion", "complaint", "other"] as const;
type FeedbackType = (typeof ALLOWED_FEEDBACK_TYPES)[number];

const CONTENT_MIN = 10;
const CONTENT_MAX = 3000;
const RATING_MIN = 1;
const RATING_MAX = 5;

function isAllowedFeedbackType(v: unknown): v is FeedbackType {
  return ALLOWED_FEEDBACK_TYPES.includes(v as FeedbackType);
}

// POST — student submits feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { courseId, type, content, rating } = body as {
      courseId?: unknown;
      type?: unknown;
      content?: unknown;
      rating?: unknown;
    };

    if (!courseId || typeof courseId !== "string" || courseId.trim().length === 0) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    if (content.length < CONTENT_MIN) {
      return NextResponse.json(
        { error: `المحتوى قصير جداً (${CONTENT_MIN} حروف على الأقل)` },
        { status: 400 }
      );
    }
    if (content.length > CONTENT_MAX) {
      return NextResponse.json(
        { error: `المحتوى طويل جداً (${CONTENT_MAX} حرف كحد أقصى)` },
        { status: 400 }
      );
    }

    // type: validated against whitelist, unknown values default to "other"
    const safeType: FeedbackType = isAllowedFeedbackType(type) ? type : "other";

    // rating: must be integer 1–5 when provided
    let safeRating: number | null = null;
    if (rating !== undefined && rating !== null) {
      const parsed = Number(rating);
      if (!Number.isInteger(parsed) || parsed < RATING_MIN || parsed > RATING_MAX) {
        return NextResponse.json(
          { error: `التقييم يجب أن يكون بين ${RATING_MIN} و ${RATING_MAX}` },
          { status: 400 }
        );
      }
      safeRating = parsed;
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId.trim() },
      select: { teacherId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });
    }

    // Check student is enrolled
    const access = await prisma.accessCode.findFirst({
      where: { courseId: courseId.trim(), studentId: session.id },
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
        courseId: courseId.trim(),
        teacherId: course.teacherId,
        type: safeType,
        content: content.trim(),
        rating: safeRating,
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

    const courseIdParam = req.nextUrl.searchParams.get("courseId");
    // Only filter by courseId if it's a non-empty string
    const courseFilter =
      courseIdParam && courseIdParam.trim().length > 0
        ? { courseId: courseIdParam.trim() }
        : {};

    const feedback = await prisma.studentFeedback.findMany({
      where: { studentId: session.id, ...courseFilter },
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
