import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/notifications — unread + last 20 for the signed-in user */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  );
}

/** POST /api/notifications — mark all as read */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
