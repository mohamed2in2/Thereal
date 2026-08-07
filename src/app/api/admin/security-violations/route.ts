import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const where: any = {};
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: "insensitive" } } },
        { student: { phone: { contains: search } } },
        { ip: { contains: search } },
      ];
    }

    const [violations, totalCount, devToolsCount, screenshotCount, vpnCount] = await Promise.all([
      prisma.securityViolation.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              phone: true,
              parentPhone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.securityViolation.count(),
      prisma.securityViolation.count({ where: { type: "DEVTOOLS" } }),
      prisma.securityViolation.count({ where: { type: "SCREENSHOT" } }),
      prisma.securityViolation.count({ where: { type: "VPN_DETECTED" } }),
    ]);

    return NextResponse.json({
      success: true,
      violations,
      stats: {
        totalCount,
        devToolsCount,
        screenshotCount,
        vpnCount,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch security violations:", error);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { studentId, action } = (await req.json()) as { studentId?: string; action?: "ban" | "unban" };

    if (!studentId || !action) {
      return NextResponse.json({ error: "البيانات غير مكتملة" }, { status: 400 });
    }

    // Toggle user status
    await prisma.user.update({
      where: { id: studentId },
      data: {
        // Suspend account if banned
        isActive: action === "ban" ? false : true,
      },
    });

    return NextResponse.json({ success: true, message: action === "ban" ? "تم حظر حساب الطالب بنجاح" : "تم إلغاء الحظر بنجاح" });
  } catch (error: any) {
    console.error("Failed to execute student security action:", error);
    return NextResponse.json({ error: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }
}
