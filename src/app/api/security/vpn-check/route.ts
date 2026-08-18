import { NextRequest, NextResponse } from "next/server";
import { isVpnOrProxy, logVpnViolation } from "@/lib/vpn-guard";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const vpnCheck = isVpnOrProxy(req.headers);

    if (vpnCheck.isVpn) {
      // Background violation log if authenticated
      const session = await getSession().catch(() => null);
      if (session?.id && session.role === "student") {
        logVpnViolation({
          studentId: session.id,
          ip: vpnCheck.ip,
          userAgent: req.headers.get("user-agent"),
          details: vpnCheck.reason,
        }).catch(() => {});
      }

      return NextResponse.json({
        isVpn: true,
        ip: vpnCheck.ip,
        reason: vpnCheck.reason,
        message: "تم رصد استخدام تطبيق VPN أو بروكسي على جهازك.",
        code: "VPN_DETECTED",
      });
    }

    return NextResponse.json({
      isVpn: false,
      ip: vpnCheck.ip,
      message: "الاتصال مباشر وآمن.",
      code: "CLEAN",
    });
  } catch (err: any) {
    return NextResponse.json(
      { isVpn: false, ip: "127.0.0.1", message: "تعذر فحص الاتصال حالياً" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
