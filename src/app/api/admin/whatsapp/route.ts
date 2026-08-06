import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { whatsapp } from "@/lib/whatsapp/index";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !["superadmin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const status = whatsapp.getStatus();
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["superadmin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, phone, message } = body;

    if (action === "reconnect") {
      await whatsapp.reconnect();
      return NextResponse.json({ success: true, message: "جارٍ إعادة الاتصال بالمحرك..." });
    }

    if (action === "logout") {
      await whatsapp.logout();
      return NextResponse.json({ success: true, message: "تم تسجيل الخروج وتصفير الجلسة." });
    }

    if (action === "test-send") {
      if (!phone || !message) {
        return NextResponse.json({ error: "رقم الهاتف ونص الرسالة مطلوبان" }, { status: 400 });
      }
      await whatsapp.sendMessage(phone, message);
      return NextResponse.json({ success: true, message: "تمت إضافة الرسالة إلى طابور الإرسال بنجاح." });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "فشلت العملية" }, { status: 500 });
  }
}
