import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Superadmin-only: list all courses for linking to plans
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = {
    teacher: { isDeleted: false }
  };
  if (stage) where.educationalStage = stage;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { subject: { contains: q } },
    ];
  }

  try {
    const courses = await prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        subject: true,
        educationalStage: true,
        teacher: { select: { id: true, name: true } },
        _count: { select: { folders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ courses });
  } catch (error) {
    console.error("Failed to fetch courses for superadmin:", error);
    return NextResponse.json({ error: "تعذر جلب الدورات" }, { status: 500 });
  }
}
