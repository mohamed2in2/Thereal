import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const viewer = await getSession();
  if (!viewer) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  const isAdmin = viewer.role === "admin" || viewer.role === "superadmin";
  const isTeacher = viewer.role === "teacher";
  const isSelf = viewer.id === id;

  const user = await prisma.user.findUnique({
    where: { id, isDeleted: false, role: "student" },
    select: {
      id: true,
      name: true,
      educationalStage: true,
      points: true,
      loginStreak: true,
      createdAt: true,
      referralCode: isAdmin || isSelf,
      quizResults: {
        select: { score: true, totalQ: true },
      },
      accessCodes: {
        where: { isActive: true },
        select: { courseId: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });

  // Rank among all students by points
  const rank = await prisma.user.count({
    where: {
      role: "student",
      isDeleted: false,
      points: { gt: user.points },
    },
  });

  // If another student is viewing this profile, only expose basic public gamification badges
  if (!isSelf && !isAdmin && !isTeacher) {
    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        educationalStage: user.educationalStage,
        points: user.points,
        loginStreak: user.loginStreak,
        rank: rank + 1,
      },
      { headers: { "Cache-Control": "private, no-cache, no-store" } }
    );
  }

  const coursesCount  = new Set(user.accessCodes.map((a) => a.courseId)).size;
  const quizzesPassed = user.quizResults.filter((q) => q.score >= 50).length;
  const avgScore      = user.quizResults.length > 0
    ? Math.round(user.quizResults.reduce((s, q) => s + q.score, 0) / user.quizResults.length)
    : 0;

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      educationalStage: user.educationalStage,
      points: user.points,
      loginStreak: user.loginStreak,
      rank: rank + 1,
      coursesCount,
      quizzesPassed,
      avgScore,
      joinedAt: user.createdAt,
      referralCode: (isAdmin || isSelf) ? user.referralCode : undefined,
    },
    { headers: { "Cache-Control": "private, no-cache, no-store" } }
  );
}
