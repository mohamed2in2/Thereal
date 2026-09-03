export interface VpnCheckResult {
  isVpn: boolean;
  reason?: string;
  ip: string;
}

/**
 * Extracts client IP address accurately from request headers.
 */
export function getClientIp(headers: Headers | Record<string, string | undefined | null>): string {
  const getHeader = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    return (headers as Record<string, string | undefined | null>)[name] ?? null;
  };

  // 1. Check trusted reverse-proxy headers first (cannot be easily spoofed by client when behind Nginx/Cloudflare)
  const trustedHeaderIp =
    getHeader("cf-connecting-ip") ||
    getHeader("x-real-ip") ||
    getHeader("fastly-client-ip") ||
    getHeader("true-client-ip");

  if (trustedHeaderIp && trustedHeaderIp.trim()) {
    return trustedHeaderIp.trim();
  }

  // 2. Fallback to rightmost or sanitized x-forwarded-for entry if behind trusted proxies
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      // If multiple IPs are present, the last or first valid IP can be used
      const candidate = parts[0];
      if (/^[0-9a-fA-F:.]+$/.test(candidate)) {
        return candidate;
      }
    }
  }

  return "127.0.0.1";
}

/**
 * Evaluates whether request headers exhibit characteristics of a VPN, proxy, or WARP tunnel.
 */
export function isVpnOrProxy(headers: Headers | Record<string, string | undefined | null>): VpnCheckResult {
  const getHeader = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    return (headers as Record<string, string | undefined | null>)[name] ?? null;
  };

  const ip = getClientIp(headers);

  const viaHeader = getHeader("via");
  const xProxyId = getHeader("x-proxy-id");
  const xWarp = getHeader("cf-warp") || getHeader("x-warp") || getHeader("warp");
  const proxyConnection = getHeader("proxy-connection");
  const forwardedFor = getHeader("x-forwarded-for") || "";
  const forwardedHops = forwardedFor ? forwardedFor.split(",").map((h) => h.trim()).filter(Boolean) : [];
  const bluecoatVia = getHeader("x-bluecoat-via");

  // 1. Explicit proxy / VPN headers
  if (viaHeader) {
    return {
      isVpn: true,
      reason: `Via Proxy header detected: ${viaHeader}`,
      ip,
    };
  }

  if (xProxyId) {
    return {
      isVpn: true,
      reason: `Proxy ID header detected: ${xProxyId}`,
      ip,
    };
  }

  if (xWarp) {
    return {
      isVpn: true,
      reason: `Cloudflare WARP / VPN header detected: ${xWarp}`,
      ip,
    };
  }

  if (proxyConnection) {
    return {
      isVpn: true,
      reason: "Proxy-Connection header detected",
      ip,
    };
  }

  if (bluecoatVia) {
    return {
      isVpn: true,
      reason: "Bluecoat Proxy header detected",
      ip,
    };
  }

  // 2. Multi-hop proxy chaining
  if (forwardedHops.length > 2) {
    return {
      isVpn: true,
      reason: `Multi-hop proxy chain detected (${forwardedHops.length} hops)`,
      ip,
    };
  }

  return {
    isVpn: false,
    ip,
  };
}

/**
 * Persists a VPN security violation log entry asynchronously without blocking request execution.
 */
export async function logVpnViolation(params: {
  studentId?: string | null;
  videoId?: string | null;
  type?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: string | null;
}): Promise<void> {
  if (!params.studentId) return;

  try {
    const { prisma } = await import("./prisma");
    // Avoid spamming violations: check if student has logged a VPN violation in last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existing = await prisma.securityViolation.findFirst({
      where: {
        studentId: params.studentId,
        type: params.type || "VPN_DETECTED",
        createdAt: { gte: twoMinutesAgo },
      },
      select: { id: true },
    });

    if (existing) return;

    await prisma.securityViolation.create({
      data: {
        studentId: params.studentId,
        videoId: params.videoId || null,
        type: params.type || "VPN_DETECTED",
        details: params.details || "VPN or Proxy connection detected",
        ip: params.ip || "127.0.0.1",
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    // Silent fail for non-blocking telemetry
    console.warn("Failed to log VPN security violation:", err);
  }
}
