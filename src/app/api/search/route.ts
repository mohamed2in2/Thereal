import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Tight bounds: meaningful minimum, prevent DB LIKE with huge strings
const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 100;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LEN) {
    return NextResponse.json({ courses: [], teachers: [], videos: [] });
  }

  // Prevent DoS: a 100-KB LIKE pattern scans entire tables
  if (q.length > MAX_QUERY_LEN) {
    return NextResponse.json(
      { error: "استعلام البحث طويل جدًا (100 حرف كحد أقصى)" },
      { status: 400 }
    );
  }

  const isStudent = session.role === "student";
  const isSuperadmin = session.role === "superadmin";
  const isTesterUser = session.accountMode === "TESTER";
  const canSeeDemo = isSuperadmin || isTesterUser;

  const teacherFilter = canSeeDemo
    ? { isDeleted: false }
    : { isDeleted: false, isDemo: false };

  // Parallel search across courses, teachers, videos
  const [courses, teachers, videos] = await Promise.all([
    prisma.course.findMany({
      where: {
        OR: [
          { title:       { contains: q } },
          { subject:     { contains: q } },
          { description: { contains: q } },
        ],
        teacher: teacherFilter,
        ...(isStudent
          ? { accessCodes: { some: { studentId: session.id, isActive: true } } }
          : {}),
      },
      select: {
        id: true,
        title: true,
        subject: true,
        thumbnailUrl: true,
        teacher: { select: { name: true } },
      },
      take: 5,
    }),

    prisma.user.findMany({
      where: {
        role: "teacher",
        isDeleted: false,
        ...(canSeeDemo ? {} : { isDemo: false }),
        OR: [{ name: { contains: q } }],
        teacherProfile: { isPublished: true },
      },
      select: {
        id: true,
        name: true,
        teacherProfile: { select: { slug: true, photoUrl: true } },
      },
      take: 4,
    }),

    isStudent
      ? prisma.video.findMany({
          where: {
            OR: [{ title: { contains: q } }],
            folder: {
              course: {
                accessCodes: { some: { studentId: session.id, isActive: true } },
              },
            },
          },
          select: {
            id: true,
            title: true,
            folderId: true,
            folder: {
              select: { courseId: true, course: { select: { title: true } } },
            },
          },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json(
    { courses, teachers, videos },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
