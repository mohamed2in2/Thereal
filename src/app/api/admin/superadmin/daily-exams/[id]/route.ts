import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.dailyExam.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting daily exam:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { isActive } = await req.json();

    const exam = await prisma.dailyExam.update({
      where: { id },
      data: { isActive }
    });
    return NextResponse.json({ exam });
  } catch (error) {
    console.error("Error updating daily exam:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const exam = await prisma.dailyExam.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } }
      }
    });
    return NextResponse.json({ exam });
  } catch (error) {
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
