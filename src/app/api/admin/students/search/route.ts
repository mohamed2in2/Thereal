import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ students: [] });

  const students = await prisma.user.findMany({
    where: {
      role: "student",
      isDeleted: false,
      OR: [
        { name:  { contains: q } },
        { phone: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      educationalStage: true,
      balance: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ students });
}
