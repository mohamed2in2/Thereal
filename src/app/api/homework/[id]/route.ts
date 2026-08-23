import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkHomeworkAccess } from "@/lib/authorization";
import { canAccessContent, ContentType } from "@/lib/content-access-engine";

/** GET /api/homework/[id] — student fetches homework details (answers hidden) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: homeworkId } = await params;

  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          question: true,
          imageUrl: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          order: true,
          // correctAnswer is intentionally omitted for students
        },
      },
    },
  });

  if (!homework) return NextResponse.json({ error: "الواجب غير موجود" }, { status: 404 });

  // Access check: ensures student is enrolled or teacher owns the course
  const hasAccess = await checkHomeworkAccess(session.id, session.role, homeworkId);
  if (!hasAccess) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول لهذا الواجب" }, { status: 403 });
  }

  // Student: only published
  if (session.role === "student" && !homework.isPublished)
    return NextResponse.json({ error: "الواجب غير منشور" }, { status: 403 });

  if (session.role === "student") {
    const access = await canAccessContent(session.id, {
      type: ContentType.HOMEWORK,
      sourceId: homeworkId,
      title: homework.title,
    });
    if ("requiredItem" in access) {
      return NextResponse.json(
        {
          error: `يجب إكمال «${access.requiredItem.title}» أولًا.`,
          code: access.code,
          requiredItem: access.requiredItem,
        },
        { status: 403 }
      );
    }
  }

  // Strip sensitive fields for students
  const safe = {
    ...homework,
    expectedOutput: session.role === "student" ? null : homework.expectedOutput,
  };

  return NextResponse.json({ homework: safe });
}
