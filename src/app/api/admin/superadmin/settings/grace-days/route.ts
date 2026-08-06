import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getTeacherGraceDays, setTeacherGraceDays, MIN_GRACE_DAYS, MAX_GRACE_DAYS,
} from "@/lib/settings";

export async function GET() {
  try {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "delete_teacher")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  return NextResponse.json({ graceDays: await getTeacherGraceDays(), min: MIN_GRACE_DAYS, max: MAX_GRACE_DAYS });
} catch (error) {
    console.error("[admin/superadmin/settings/grace-days] error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
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
  if (!session || !hasPermission(session.role, "delete_teacher")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { graceDays?: number };
  const n = Number(body.graceDays);
  if (!Number.isFinite(n) || n < MIN_GRACE_DAYS || n > MAX_GRACE_DAYS) {
    return NextResponse.json({ error: `عدد الأيام يجب أن يكون بين ${MIN_GRACE_DAYS} و ${MAX_GRACE_DAYS}` }, { status: 400 });
  }
  const graceDays = await setTeacherGraceDays(n);
  return NextResponse.json({ graceDays });
} catch (error) {
    console.error("[admin/superadmin/settings/grace-days] error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي" },
      { status: 500 }
    );
  }
}
