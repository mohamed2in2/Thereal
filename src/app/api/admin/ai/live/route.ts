import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Telemetry } from "@/ai/telemetry/Telemetry";
import { TelemetryEvent } from "@/ai/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "owner")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const events: TelemetryEvent[] = Telemetry.getInstance().getEvents(30);

    const formattedRequests = events.map((e: TelemetryEvent) => ({
      id: e.id || `req_${Date.now()}`,
      time: new Date(e.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      studentName: "طالب",
      subject: e.subject || "الفيزياء",
      action: e.action || "Explain",
      provider: e.provider || "DeepSeek",
      status: e.success ? "success" : "failed",
      latencyMs: e.latencyMs || 450,
      tokens: (e.inputTokens || 0) + (e.outputTokens || 0),
      costUsd: 0.0003,
      intent: e.action,
    }));

    return NextResponse.json({ requests: formattedRequests });
  } catch (err) {
    console.error("AI Live Monitor API error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
