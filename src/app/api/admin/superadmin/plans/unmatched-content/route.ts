import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  try {
    const items = await prisma.unmatchedPlanContent.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        video: { select: { title: true } }
      },
      skip,
      take: limit,
    });

    const total = await prisma.unmatchedPlanContent.count({
      where: { resolvedAt: null }
    });

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch unmatched content:", error);
    return NextResponse.json({ error: "تعذر جلب المحتوى غير المطابق" }, { status: 500 });
  }
}
