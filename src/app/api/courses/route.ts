import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const subject = searchParams.get("subject");
    const teacherId = searchParams.get("teacher");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      teacher: { isDeleted: false },
    };
    if (stage) where.educationalStage = stage;
    if (subject) where.subject = subject;
    if (teacherId) where.teacherId = teacherId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const session = await getStudentSession();

    const [courses, allTeachers] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              teacherProfile: { select: { photoUrl: true, displayName: true, slug: true, isPublished: true } },
            },
          },
          _count: { select: { accessCodes: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: "teacher", isDeleted: false },
        select: {
          id: true,
          name: true,
          teacherProfile: { select: { photoUrl: true, displayName: true, slug: true, isPublished: true } },
          _count: { select: { courses: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formattedTeachers = allTeachers.map((t) => ({
      id: t.id,
      name: t.teacherProfile?.displayName || t.name,
      photoUrl: t.teacherProfile?.photoUrl || null,
      courseCount: t._count?.courses || 0,
      slug: t.teacherProfile?.slug || null,
      hasPublicPage: !!(t.teacherProfile?.isPublished && t.teacherProfile?.slug),
    }));

    if (!session) {
      const response = NextResponse.json({
        courses: courses.map((course) => ({ ...course, hasAccess: false })),
        teachers: formattedTeachers,
      });
      response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      return response;
    }

    const accessCodes = await prisma.accessCode.findMany({
      where: {
        studentId: session.id,
        courseId: { in: courses.map((course) => course.id) },
      },
      select: { courseId: true },
    });

    const accessMap = new Set(accessCodes.map((code) => code.courseId));
    const coursesWithAccess = courses.map((course) => ({ ...course, hasAccess: accessMap.has(course.id) }));

    const response = NextResponse.json({ courses: coursesWithAccess, teachers: formattedTeachers });
    response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
    return response;
  } catch (error) {
    console.error("Courses API error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحميل الكورسات" }, { status: 500 });
  }
}
