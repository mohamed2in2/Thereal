import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GeminiClusterDashboard, GeminiKeyView } from "@/ai/admin/monitoring/GeminiClusterDashboard";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "owner")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const cluster = GeminiClusterDashboard.getInstance().getSummary();

    const keys = (cluster.keys || []).map((k: GeminiKeyView) => ({
      displayName: k.displayName,
      status: k.status,
      requestsToday: k.dailyRequests || 0,
      remainingQuota: k.remainingQuota || 50000,
      latencyMs: k.averageLatencyMs || 0,
      lastUsed: k.lastError ? "خطأ في آخر استخدام" : "متاح",
    }));

    return NextResponse.json({ keys });
  } catch (err) {
    console.error("AI Gemini Pool API error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
