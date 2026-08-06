import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/homework/[id] — teacher views a single homework */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "teacher")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id } = await params;
  const hw = await prisma.homework.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      submissions: { select: { id: true, status: true, studentId: true } },
      video: { select: { id: true, title: true } },
    },
  });
  if (!hw || hw.teacherId !== session.id)
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json({ homework: hw });
}

/** DELETE /api/admin/homework/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "teacher")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id } = await params;
  const hw = await prisma.homework.findUnique({ where: { id }, select: { teacherId: true } });
  if (!hw || hw.teacherId !== session.id)
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  await prisma.homework.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
