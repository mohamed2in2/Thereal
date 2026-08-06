import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AIAuditSystem } from "@/ai/admin/audit_logging/AIAuditSystem";

async function checkSuperadmin() {
  const session = await getSession();
  if (!session || (session.role !== "superadmin" && session.role !== "admin" && session.role !== "owner")) {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  try {
    const session = await checkSuperadmin();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));
    const who = searchParams.get("who");
    const action = searchParams.get("action");

    const auditSystem = AIAuditSystem.getInstance();
    let logs;

    if (who) {
      logs = auditSystem.filterByWho(who, limit);
    } else if (action) {
      logs = auditSystem.filterByAction(action, limit);
    } else {
      logs = auditSystem.getAuditTrail(limit);
    }

    return NextResponse.json({ success: true, logs });
  } catch (err) {
    console.error("AI Audit GET error:", err);
    return NextResponse.json({ error: "حدث خطأ في استرجاع سجلات التدقيق" }, { status: 500 });
  }
}
