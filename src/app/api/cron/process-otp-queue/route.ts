import { NextRequest, NextResponse } from "next/server";
import { OtpService } from "@/services/otp/OtpService";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "codeup_secret_cron";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const result = await OtpService.processQueuedOtps(25);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron OTP Process Error]:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء معالجة قائمة الانتظار" }, { status: 500 });
  }
}
