import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { getStudentMaxDevices, setStudentMaxDevices, MIN_DEVICES, MAX_DEVICES } from "@/lib/settings";

export async function GET() {
  try {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  return NextResponse.json({ maxDevices: await getStudentMaxDevices(), min: MIN_DEVICES, max: MAX_DEVICES });
} catch (error) {
    console.error("[admin/superadmin/settings/max-devices] error:", error);
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
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { maxDevices?: number };
  const n = Number(body.maxDevices);
  if (!Number.isFinite(n) || n < MIN_DEVICES || n > MAX_DEVICES) {
    return NextResponse.json({ error: `عدد الأجهزة يجب أن يكون بين ${MIN_DEVICES} و ${MAX_DEVICES}` }, { status: 400 });
  }
  const maxDevices = await setStudentMaxDevices(n);
  return NextResponse.json({ maxDevices });
} catch (error) {
    console.error("[admin/superadmin/settings/max-devices] error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي" },
      { status: 500 }
    );
  }
}
