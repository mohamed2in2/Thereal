import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";
import {
  getMaintenanceMode,
  setMaintenanceMode,
  getMaintenanceMessage,
  setMaintenanceMessage,
} from "@/lib/settings";

async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "superadmin" || !session.isOwner) return null;
  return session;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const [on, message] = await Promise.all([getMaintenanceMode(), getMaintenanceMessage()]);
  return NextResponse.json({ on, message });
}

export async function POST(req: NextRequest) {
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

  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      on?: boolean;
      message?: string;
      actionPassword?: string;
    };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    if (typeof body.message === "string") {
      await setMaintenanceMessage(body.message);
    }
    let on = await getMaintenanceMode();
    if (typeof body.on === "boolean") {
      on = await setMaintenanceMode(body.on);
      await logAdminAction({
        adminId: session.id,
        adminName: session.name,
        action: body.on ? "MAINTENANCE_ON" : "MAINTENANCE_OFF",
        targetType: "system",
        targetId: "maintenance",
        targetName: "وضع الصيانة",
      });
    }

    const message = await getMaintenanceMessage();
    return NextResponse.json({ success: true, on, message });
  } catch (error) {
    console.error("Maintenance toggle error:", error);
    const detail = error instanceof Error ? error.message.slice(0, 200) : "";
    return NextResponse.json(
      { error: `تعذر تحديث وضع الصيانة${detail ? ` — ${detail}` : ""}` },
      { status: 500 }
    );
  }
}
