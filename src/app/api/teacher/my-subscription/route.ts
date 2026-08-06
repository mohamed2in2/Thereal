import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ subscription: null });
  }

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  if (!teacherId) {
    return NextResponse.json({ error: "teacherId is required" }, { status: 400 });
  }

  const subscription = await prisma.teacherSubscription.findFirst({
    where: {
      studentId: session.id,
      teacherId,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      planType: true,
      planLabel: true,
      amount: true,
      educationalStage: true,
      createdAt: true,
      status: true,
    },
  });

  return NextResponse.json({ subscription });
}
