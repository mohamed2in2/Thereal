import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Superadmin: get a specific course with all folders and videos for plan content linking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true } },
        folders: {
          orderBy: { order: "asc" },
          include: {
            videos: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                order: true,
                lessonIndexInMonth: true,
                lessonIndexIsManual: true,
              }
            },
            quizzes: {
              select: { id: true, title: true, timeLimitMinutes: true, _count: { select: { questions: true } } }
            }
          }
        },
      }
    });

    if (!course) {
      return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error) {
    console.error("Failed to fetch course for superadmin:", error);
    return NextResponse.json({ error: "تعذر جلب بيانات الدورة" }, { status: 500 });
  }
}
