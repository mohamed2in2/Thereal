import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reissueParentToken } from "@/lib/whatsapp/parentToken";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      parentPhone?: string;
      studentId?: string;
      allowSamePhone?: boolean;
    };
    const { parentPhone, studentId, allowSamePhone } = body;

    if (!parentPhone || typeof parentPhone !== "string") {
      return NextResponse.json({ error: "رقم هاتف ولي الأمر مطلوب" }, { status: 400 });
    }

    let targetStudentId = session.id;
    let isAdmin = false;

    if (studentId && typeof studentId === "string") {
      if (session.role !== "admin" && session.role !== "superadmin" && session.role !== "staff") {
        return NextResponse.json({ error: "غير مصرح لك بإدارة هذا الطالب" }, { status: 403 });
      }
      targetStudentId = studentId;
      isAdmin = true;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await reissueParentToken(targetStudentId, parentPhone, ip, userAgent, {
      allowSamePhone: allowSamePhone || isAdmin,
      bypassRateLimit: isAdmin,
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال رابط متابعة جديد لولي أمرك عبر الواتساب بنجاح",
      dispatchSuccess: result.dispatchResult?.success ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "تعذر إرسال الرابط" }, { status: 400 });
  }
}
