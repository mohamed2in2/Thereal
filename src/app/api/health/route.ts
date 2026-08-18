import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Operational health check.
 *
 * Two audiences, one endpoint:
 *
 *  - Unauthenticated (load balancer / uptime monitor): `{ok, status}` only. A
 *    degraded dependency must not tell an anonymous caller *which* dependency,
 *    since that maps the attack surface.
 *  - Superadmin: the full picture — which subsystems are configured and
 *    reachable. Booleans and latencies only; no secret ever leaves here.
 *
 * The checks deliberately mirror the failure modes that are silent in this
 * codebase: a missing webhook secret makes both payment gateways reject every
 * callback with a 500, and a missing OTP channel makes signup and password reset
 * fail — neither surfaces anywhere else until a user complains.
 */

export const dynamic = "force-dynamic";

type CheckState = "ok" | "degraded" | "down";

interface Check {
  state: CheckState;
  detail: string;
  latencyMs?: number;
}

async function checkDatabase(): Promise<Check> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;
    return {
      state: latencyMs > 1000 ? "degraded" : "ok",
      detail: latencyMs > 1000 ? "reachable but slow" : "reachable",
      latencyMs,
    };
  } catch (err) {
    return {
      state: "down",
      detail: err instanceof Error ? err.message : "query failed",
      latencyMs: Date.now() - startedAt,
    };
  }
}

function checkPaymentWebhooks(): Check {
  const sha7nawy = Boolean(process.env.SHA7NAWY_WEBHOOK_SECRET);
  const shakeout = Boolean(process.env.SHAKEOUT_WEBHOOK_SECRET);

  if (sha7nawy && shakeout) return { state: "ok", detail: "both gateway secrets configured" };
  if (!sha7nawy && !shakeout) {
    return {
      state: "down",
      detail: "no webhook secrets set — every gateway callback is rejected and top-ups are never credited",
    };
  }
  return {
    state: "degraded",
    detail: `${sha7nawy ? "shakeout" : "sha7nawy"} webhook secret missing — that gateway's callbacks are rejected`,
  };
}

function checkOtpChannels(): Check {
  const meta = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PERMANENT_TOKEN);
  const sns = Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      process.env.AWS_USE_INSTANCE_ROLE === "true"
  );

  if (meta && sns) return { state: "ok", detail: "WhatsApp Cloud API with AWS SNS fallback" };
  if (meta) return { state: "degraded", detail: "WhatsApp Cloud API only — no SMS fallback" };
  if (sns) return { state: "degraded", detail: "AWS SNS only — WhatsApp Cloud API not configured" };
  return {
    state: "down",
    detail: "no OTP channel configured — signup and password reset will fail",
  };
}

function checkCron(): Check {
  return process.env.CRON_SECRET
    ? { state: "ok", detail: "CRON_SECRET set" }
    : { state: "down", detail: "CRON_SECRET unset — /api/cron/* rejects every call, OTP queue never drains" };
}

function checkVideoProvider(): Check {
  const apiKey = process.env.VIDEO_API_KEY || process.env.ALASLY_API_KEY;
  const apiSecret = process.env.VIDEO_API_SECRET || process.env.ALASLY_API_SECRET;
  const configured = Boolean(apiKey && apiSecret);
  if (!configured) {
    return { state: "degraded", detail: "Alasly video credentials unset — those lessons cannot resolve playback" };
  }
  // The literals that were previously committed to the repository.
  const leaked =
    apiKey === "alk_06a5ofogdqo11inzwoqn186jukk0bh7o" ||
    apiSecret === "als_ga4xg1zjs8h94ksv4rgbrc6yb4cjngf4pl0u7evxc106k7lq";
  if (leaked) {
    return { state: "degraded", detail: "using the previously published credentials — rotate them" };
  }
  return { state: "ok", detail: "configured" };
}

function worstState(checks: Record<string, Check>): CheckState {
  const states = Object.values(checks).map((c) => c.state);
  if (states.includes("down")) return "down";
  if (states.includes("degraded")) return "degraded";
  return "ok";
}

export async function GET() {
  const checks: Record<string, Check> = {
    database: await checkDatabase(),
    paymentWebhooks: checkPaymentWebhooks(),
    otpDelivery: checkOtpChannels(),
    cron: checkCron(),
    videoProvider: checkVideoProvider(),
  };

  const status = worstState(checks);
  // A degraded dependency still serves traffic; only a hard failure should pull
  // the instance out of a load balancer.
  const httpStatus = status === "down" ? 503 : 200;

  const session = await getSession().catch(() => null);
  const isOperator = session?.role === "superadmin" || session?.role === "admin";

  if (!isOperator) {
    return NextResponse.json(
      { ok: status !== "down", status },
      { status: httpStatus, headers: { "Cache-Control": "no-store" } }
    );
  }

  const memory = process.memoryUsage();

  return NextResponse.json(
    {
      ok: status !== "down",
      status,
      checks,
      process: {
        pid: process.pid,
        // Which PM2 worker answered — useful when only one instance misbehaves.
        instance: process.env.NODE_APP_INSTANCE ?? null,
        uptimeSeconds: Math.round(process.uptime()),
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      database: {
        // Scheme only — never the DSN, which carries credentials.
        driver: (process.env.DATABASE_URL ?? "").split(":")[0] || "unset",
      },
      checkedAt: new Date().toISOString(),
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
