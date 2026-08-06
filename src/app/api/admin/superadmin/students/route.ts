import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

function buildWhere(params: {
  name: string;
  stage: string;
  ageNum: number | undefined;
  phone: string;
  parentPhone: string;
}) {
  return {
    role: "student",
    isDeleted: false,
    name: params.name ? { contains: params.name } : undefined,
    educationalStage: params.stage || undefined,
    age: params.ageNum,
    phone: params.phone ? { contains: params.phone } : undefined,
    parentPhone: params.parentPhone ? { contains: params.parentPhone } : undefined,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "view_students")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name")?.trim() ?? "";
    const stage = searchParams.get("stage")?.trim() ?? "";
    const ageRaw = searchParams.get("age")?.trim() ?? "";
    const phone = searchParams.get("phone")?.trim() ?? "";
    const parentPhone = searchParams.get("parentPhone")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);
    const ageNum = ageRaw !== "" && !isNaN(parseInt(ageRaw)) ? parseInt(ageRaw) : undefined;

    const where = buildWhere({ name, stage, ageNum, phone, parentPhone });

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          age: true,
          educationalStage: true,
          phone: true,
          parentPhone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ students, total });
  } catch (error) {
    console.error("Superadmin students fetch error:", error);
    return NextResponse.json({ error: "تعذر جلب المتعلمين" }, { status: 500 });
  }
}
