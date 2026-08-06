import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: "asc" }
        }
      }
    });

    if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Failed to fetch plan:", error);
    return NextResponse.json({ error: "تعذر جلب بيانات الخطة" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { 
      lastKnownUpdatedAt, 
      title, 
      description, 
      price, 
      discountPrice, 
      discountExpiresAt, 
      durationDays, 
      chatEnabled, 
      gradingAIEnabled,
      educationalStage,
      monthIndex
    } = body;

    // Optimistic Concurrency Control
    if (!lastKnownUpdatedAt) {
      return NextResponse.json({ error: "missing lastKnownUpdatedAt for concurrency control" }, { status: 400 });
    }

    const currentPlan = await prisma.plan.findUnique({ where: { id } });
    if (!currentPlan) {
      return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
    }

    if (currentPlan.updatedAt.getTime() !== new Date(lastKnownUpdatedAt).getTime()) {
      return NextResponse.json({ 
        error: "تم تعديل الخطة من قبل مسؤول آخر مؤخراً. يرجى تحديث الصفحة.", 
        code: "CONCURRENCY_CONFLICT" 
      }, { status: 409 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (discountPrice !== undefined) data.discountPrice = discountPrice;
    if (discountExpiresAt !== undefined) data.discountExpiresAt = discountExpiresAt ? new Date(discountExpiresAt) : null;
    if (durationDays !== undefined) data.durationDays = durationDays;
    if (chatEnabled !== undefined) data.chatEnabled = chatEnabled;
    if (gradingAIEnabled !== undefined) data.gradingAIEnabled = gradingAIEnabled;
    if (educationalStage !== undefined) data.educationalStage = educationalStage;
    if (monthIndex !== undefined) data.monthIndex = Number(monthIndex);
    data.updatedById = session.id;

    const plan = await prisma.plan.update({
      where: { id },
      data,
    });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "UPDATE_PLAN",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Updated plan: ${plan.title} (${plan.id})` },
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Failed to update plan:", error);
    return NextResponse.json({ error: "تعذر تحديث الخطة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const plan = await prisma.plan.findUnique({ 
      where: { id },
      include: {
        _count: { select: { enrollments: true } }
      }
    });

    if (!plan) {
      return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
    }

    await prisma.plan.delete({ where: { id } });

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "DELETE_PLAN",
      targetType: "Plan", 
      targetId: "sys", 
      targetName: "action", 
      metadata: { details: `Deleted plan: ${plan.title} (${plan.id}) with ${plan._count?.enrollments || 0} enrollments` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete plan:", error);
    return NextResponse.json({ error: "تعذر حذف الخطة" }, { status: 500 });
  }
}
