import { NextRequest, NextResponse } from "next/server";
import { confirmParentToken, rejectParentToken } from "@/lib/whatsapp/parentToken";
import { parentRateLimiter } from "@/lib/whatsapp/parentRateLimiter";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";

    // Strict Rate Limiting: 5 attempts per IP per minute for verification responses
    const rateCheck = parentRateLimiter.checkRateLimit(`verify_${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `تم تجاوز عدد المحاولات. يرجى الانتظار ${rateCheck.resetInSeconds} ثانية.` },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { token?: string; answer?: "YES" | "NO" };
    const { token, answer } = body;

    if (!token || !answer || (answer !== "YES" && answer !== "NO")) {
      return NextResponse.json({ error: "بيانات الإجابة غير مكتملة" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;

    if (answer === "YES") {
      const res = await confirmParentToken(token, ip, userAgent);
      if (!res) {
        return NextResponse.json({ ok: true, stage: "DEAD" });
      }
      return NextResponse.json({ ok: true, stage: "REPORT" });
    } else {
      const res = await rejectParentToken(token, ip, userAgent);
      if (!res) {
        return NextResponse.json({ ok: true, stage: "DEAD" });
      }
      return NextResponse.json({ ok: true, stage: "DEAD" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "تعذر معالجة التأكيد" }, { status: 500 });
  }
}
