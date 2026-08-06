import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { iqData: true, overallIQ: true },
  });

  const studentCount = await prisma.user.count({ where: { role: "student" } });
  
  // Calculate monthly ranking stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Count how many students have updated their IQ this calendar month
  const monthlyCount = await prisma.user.count({
    where: {
      role: "student",
      overallIQ: { gt: 0 },
      updatedAt: { gte: startOfMonth }
    }
  });

  const currentUserIQ = user?.overallIQ ?? 1000;
  
  let rank = 1;
  let totalRanked = 1;
  let averageIQ = 1000;
  let rankingPeriod = "overall";

  if (monthlyCount >= 5) {
    // Ranking among students active this month
    rank = await prisma.user.count({
      where: {
        role: "student",
        overallIQ: { gt: currentUserIQ },
        updatedAt: { gte: startOfMonth }
      }
    }) + 1;
    totalRanked = monthlyCount;
    const avgIQVal = await prisma.user.aggregate({
      where: {
        role: "student",
        overallIQ: { gt: 0 },
        updatedAt: { gte: startOfMonth }
      },
      _avg: { overallIQ: true }
    });
    averageIQ = Math.round(avgIQVal._avg.overallIQ || 1000);
    rankingPeriod = "monthly";
  } else {
    // Overall ranking fallback
    rank = await prisma.user.count({
      where: {
        role: "student",
        overallIQ: { gt: currentUserIQ }
      }
    }) + 1;
    totalRanked = await prisma.user.count({
      where: {
        role: "student",
        overallIQ: { gt: 0 }
      }
    });
    const avgIQVal = await prisma.user.aggregate({
      where: {
        role: "student",
        overallIQ: { gt: 0 }
      },
      _avg: { overallIQ: true }
    });
    averageIQ = Math.round(avgIQVal._avg.overallIQ || 1000);
    rankingPeriod = "overall";
  }

  return NextResponse.json({
    iqData: user?.iqData ?? null,
    studentCount,
    rank,
    totalRanked,
    averageIQ,
    isAdaptive: studentCount > 100,
    rankingPeriod
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { iqData } = body as { iqData: string };

    if (typeof iqData !== "string") {
      return NextResponse.json({ error: "Invalid iqData" }, { status: 400 });
    }

    // Validate it's valid JSON before storing
    const parsed = JSON.parse(iqData);
    const overallIQ = Number(parsed.overallIQ) || 1000;

    await prisma.user.update({
      where: { id: session.id },
      data: {
        iqData,
        overallIQ,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
