import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";
import {
  getSiteText,
  setSiteText,
  SITE_TEXT_DEFAULTS,
  SITE_TEXT_LABELS,
} from "@/lib/site-text";

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const text = await getSiteText();
  return NextResponse.json({ text, defaults: SITE_TEXT_DEFAULTS, labels: SITE_TEXT_LABELS });
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

  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      updates?: Record<string, string>;
      actionPassword?: string;
    };

    if (!verifyRoleActionPassword(session.role, body.actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }
    if (!body.updates || typeof body.updates !== "object") {
      return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
    }

    const keys = Object.keys(body.updates).filter((k) => k in SITE_TEXT_DEFAULTS);
    for (const k of keys) {
      await setSiteText(k, body.updates[k]);
    }

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "EDIT_SITE_TEXT",
      targetType: "system",
      targetId: "site-text",
      targetName: "نصوص الموقع",
      metadata: { keys },
    });

    const text = await getSiteText();
    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error("Site-text update error:", error);
    return NextResponse.json({ error: "تعذر حفظ النصوص" }, { status: 500 });
  }
}
