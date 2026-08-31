import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "superadmin" || !session.isOwner) return null;
  return session;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح — مخصص للمالك فقط" }, { status: 403 });
  }

  try {
    const [recentStudents, activityLogs, totalStudents] = await Promise.all([
      // 1. Live stream of newly created student accounts
      prisma.user.findMany({
        where: { role: "student", isDeleted: false },
        select: {
          id: true,
          name: true,
          phone: true,
          parentPhone: true,
          educationalStage: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          isActive: true,
          points: true,
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),

      // 2. Real-time actions & deletions log
      prisma.activityLog.findMany({
        select: {
          id: true,
          adminId: true,
          adminName: true,
          action: true,
          targetType: true,
          targetId: true,
          targetName: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // 3. Count total students
      prisma.user.count({ where: { role: "student", isDeleted: false } }),
    ]);

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      totalStudents,
      recentStudents,
      activityLogs: activityLogs.map((log) => {
        let meta: Record<string, unknown> | null = null;
        if (log.metadata) {
          try {
            meta = JSON.parse(log.metadata);
          } catch {
            meta = null;
          }
        }
        return {
          ...log,
          meta,
        };
      }),
    });
  } catch (error) {
    console.error("Live logs error:", error);
    return NextResponse.json(
      { error: "تعذر جلب سجلات النشاط المباشرة" },
      { status: 500 }
    );
  }
}
