import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ProviderMonitor, ProviderStats } from "@/ai/admin/monitoring/ProviderMonitor";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "owner")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const stats: ProviderStats[] = ProviderMonitor.getInstance().getAllStats();
    const list = stats.map((p) => ({
      id: p.providerId,
      name: p.providerId,
      status: p.status || "Healthy",
      latencyMs: p.requestCount > 0 ? Math.round(p.totalLatencyMs / p.requestCount) : 0,
      successRate: p.requestCount > 0 ? Math.round((p.successCount / p.requestCount) * 100) : 100,
      requestsToday: p.dailyRequests || p.requestCount || 0,
      tokensToday: p.dailyTokens || (p.promptTokensTotal + p.completionTokensTotal) || 0,
      costToday: p.estimatedCostUsd || 0,
      cacheHitRate: (p.cacheHits + p.cacheMisses) > 0 ? Math.round((p.cacheHits / (p.cacheHits + p.cacheMisses)) * 100) : 0,
    }));

    return NextResponse.json({ providers: list });
  } catch (err) {
    console.error("AI Providers API error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
