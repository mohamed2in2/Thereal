import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const devices = await prisma.device.findMany({
    where: { userId: session.id },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      deviceId: true,
      label: true,
      userAgent: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  // Fetch live streak/freeze counts from DB (not in session JWT)
  const userRow = await prisma.user.findUnique({
    where: { id: session.id },
    select: { loginStreak: true, streakFreezes: true },
  });

  return NextResponse.json(
    { devices, loginStreak: userRow?.loginStreak ?? 0, streakFreezes: userRow?.streakFreezes ?? 0 },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
