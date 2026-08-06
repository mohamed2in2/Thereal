import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateConfigCache, CONFIG_DEFINITIONS } from "@/lib/config";

/** GET /api/admin/superadmin/settings/[key] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { key } = await params;
  const setting = await prisma.platformConfig.findUnique({ where: { key } });
  return NextResponse.json({ setting });
}

/** PATCH /api/admin/superadmin/settings/[key] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "superadmin")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { key } = await params;
  const { value } = await req.json() as { value: string };

  const def = CONFIG_DEFINITIONS.find(d => d.key === key);
  const type = def?.type ?? "string";
  const category = def?.category ?? "custom";
  const label = def?.label ?? key;

  const setting = await prisma.platformConfig.upsert({
    where: { key },
    create: {
      key,
      value: String(value),
      type,
      category,
      label,
    },
    update: {
      value: String(value),
    },
  });

  invalidateConfigCache();

  return NextResponse.json({ setting });
}
