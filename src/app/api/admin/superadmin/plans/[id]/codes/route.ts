import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit")) || 50));
  const skip = (page - 1) * limit;

  try {
    const codes = await prisma.planAccessCode.findMany({
      where: { planId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.planAccessCode.count({
      where: { planId }
    });

    return NextResponse.json({ codes, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch plan access codes:", error);
    return NextResponse.json({ error: "تعذر جلب الأكواد" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(1, Math.floor(Number(body.count) || 1)), 500);
    const prefix = body.prefix ? String(body.prefix).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "";

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });

    const crypto = await import("crypto");
    
    const createdCodes: any[] = [];
    for (let i = 0; i < count; i++) {
      let code = "";
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 20) {
        attempts++;
        const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
        code = prefix ? `${prefix}-${hex}` : hex;
        if (!createdCodes.some(c => c.code === code)) {
          const dbExists = await prisma.planAccessCode.findUnique({ where: { code }, select: { id: true } });
          if (!dbExists) exists = false;
        }
      }
      
      if (exists) return NextResponse.json({ error: "تعذر إنشاء كود فريد" }, { status: 409 });

      const created = await prisma.planAccessCode.create({
        data: {
          code,
          planId,
        }
      });
      createdCodes.push(created);
    }

    // Log bulk generation
    const { logAdminAction } = await import("@/lib/admin-auth");
    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "GENERATE_PLAN_CODES",
      targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: `Generated ${count} access codes for plan ${planId}` },
    });

    return NextResponse.json({ codes: createdCodes }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate plan access codes:", error);
    return NextResponse.json({ error: "تعذر توليد الأكواد" }, { status: 500 });
  }
}
