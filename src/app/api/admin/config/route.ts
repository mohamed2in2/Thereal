import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGroupedConfig, setConfig } from "@/lib/config";
import { logAdminAction } from "@/lib/admin-auth";

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

/** All config grouped by category (superadmin only). */
export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const groups = await getGroupedConfig();
  return NextResponse.json({ groups });
}

/** Update one setting; cache is invalidated so it takes effect immediately. */
export async function PATCH(req: NextRequest) {
    const __logSession = await getSession();
    if (__logSession && __logSession.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: __logSession.id,
          adminName: __logSession.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }

  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
    if (!body.key) return NextResponse.json({ error: "المفتاح مطلوب" }, { status: 400 });

    await setConfig(body.key, body.value);

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "EDIT_CONFIG",
      targetType: "config",
      targetId: body.key,
      targetName: body.key,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذر حفظ الإعداد";
    const status = msg === "Unknown config key" ? 400 : 500;
    if (status === 500) console.error("Config PATCH error:", error);
    return NextResponse.json({ error: status === 400 ? "مفتاح غير معروف" : msg }, { status });
  }
}
