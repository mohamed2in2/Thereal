import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Superadmin-only: platform-wide overview stats. */
export async function GET() {
  const session = await getSession();
  if (!session || !["superadmin", "admin", "staff"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const [totalStudents, totalTeachers, teachers] = await Promise.all([
      // Total active students (not deleted)
      prisma.user.count({ where: { role: "student", isDeleted: false } }),

      // Total active teachers
      prisma.user.count({ where: { role: "teacher", isDeleted: false } }),

      // Teachers with their courses + per-course student (access code) counts
      prisma.user.findMany({
        where: { role: "teacher", isDeleted: false },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          courses: {
            where: { /* all courses */ },
            select: {
              id: true,
              title: true,
              subject: true,
              isPaid: true,
              price: true,
              educationalStage: true,
              _count: {
                select: {
                  // Count access codes that have been used (= enrolled students)
                  accessCodes: true,
                },
              },
              accessCodes: {
                where: { studentId: { not: null } },
                select: { studentId: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Shape the data: compute per-course enrolled students + revenue
    const teachersWithStats = teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      createdAt: t.createdAt,
      totalCourses: t.courses.length,
      courses: t.courses.map((c) => {
        const enrolledStudents = c.accessCodes.filter((ac) => ac.studentId).length;
        const revenue = c.isPaid && c.price ? enrolledStudents * c.price : 0;
        return {
          id: c.id,
          title: c.title,
          subject: c.subject,
          educationalStage: c.educationalStage,
          isPaid: c.isPaid,
          price: c.price ?? 0,
          enrolledStudents,
          revenue,
        };
      }),
    }));

    // Platform-wide totals
    const totalCourses = teachersWithStats.reduce((s, t) => s + t.totalCourses, 0);
    const totalRevenue = teachersWithStats.reduce(
      (s, t) => s + t.courses.reduce((cs, c) => cs + c.revenue, 0),
      0
    );

    return NextResponse.json({
      totalStudents,
      totalTeachers,
      totalCourses,
      totalRevenue,
      teachers: teachersWithStats,
    });
  } catch (error) {
    console.error("[superadmin/overview] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
