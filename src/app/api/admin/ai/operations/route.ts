import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AIOperationsConfig } from "@/ai/admin/config/AIOperationsConfig";

async function checkSuperadmin() {
  const session = await getSession();
  if (!session || (session.role !== "superadmin" && session.role !== "admin" && session.role !== "owner")) {
    return null;
  }
  return session;
}

export async function GET() {
  try {
    const session = await checkSuperadmin();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const settings = AIOperationsConfig.getInstance().getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error("AI Operations GET error:", err);
    return NextResponse.json({ error: "حدث خطأ في استرجاع إعدادات الذكاء الاصطناعي" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await checkSuperadmin();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { patch, reason } = body;

    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "البيانات المطلوبة للتحديث غير صحيحة" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const who = session.name || session.email || "superadmin";

    AIOperationsConfig.getInstance().updateSettings(patch, who, ip, reason);

    const updatedSettings = AIOperationsConfig.getInstance().getSettings();
    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error("AI Operations PATCH error:", err);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث إعدادات الذكاء الاصطناعي" }, { status: 500 });
  }
}
