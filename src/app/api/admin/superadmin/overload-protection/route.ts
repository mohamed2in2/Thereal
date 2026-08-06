import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyRoleActionPassword, logAdminAction } from "@/lib/admin-auth";
import {
  getOverloadProtectionState,
  setOverloadMode,
  setOverloadRamThreshold,
  setOverloadCooldownTime,
  addOverloadCooldownMinutes,
  setOverloadMessage,
} from "@/lib/overload-protection";

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const state = await getOverloadProtectionState();
    return NextResponse.json({ state });
  } catch (err: any) {
    console.error("Overload GET error:", err);
    return NextResponse.json({ error: "تعذر تحميل إعدادات الحماية" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { actionPassword, action, mode, thresholdPct, addMinutes, message } = body;

    if (!verifyRoleActionPassword(session.role, actionPassword ?? "")) {
      return NextResponse.json({ error: "كلمة مرور المشرف غير صحيحة" }, { status: 401 });
    }

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: `OVERLOAD_${action?.toUpperCase() || "UPDATE"}`,
      targetType: "system",
      targetId: "overload_protection",
      targetName: "حماية السيرفر الاستباقية",
    });

    if (action === "setMode") {
      if (mode === "auto" || mode === "on" || mode === "off") {
        await setOverloadMode(mode);
      }
    } else if (action === "setThreshold") {
      if (typeof thresholdPct === "number") {
        await setOverloadRamThreshold(thresholdPct);
      }
    } else if (action === "addCooldown") {
      const mins = typeof addMinutes === "number" ? addMinutes : 15;
      await addOverloadCooldownMinutes(mins);
    } else if (action === "resetCooldown") {
      await setOverloadCooldownTime(null);
    } else if (action === "setMessage") {
      if (typeof message === "string") {
        await setOverloadMessage(message);
      }
    }

    const newState = await getOverloadProtectionState();
    return NextResponse.json({ success: true, state: newState });
  } catch (err: any) {
    console.error("Overload POST error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء تعديل الحماية" }, { status: 500 });
  }
}
