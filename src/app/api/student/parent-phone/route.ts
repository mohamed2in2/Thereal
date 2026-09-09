import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reissueParentToken, resetParentVerificationLimits } from "@/lib/whatsapp/parentToken";

// Egyptian numbers: +201xxxxxxxxx = 13 chars max after normalisation
const MAX_PHONE_LEN = 30;

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
      resetCount?: boolean;
    };
    const { parentPhone, studentId, allowSamePhone, resetCount } = body;

    let targetStudentId = session.id;
    let isAdmin = false;

    if (studentId && typeof studentId === "string") {
      if (
        session.role !== "admin" &&
        session.role !== "superadmin" &&
        session.role !== "staff"
      ) {
        return NextResponse.json(
          { error: "غير مصرح لك بإدارة هذا الطالب" },
          { status: 403 }
        );
      }
      targetStudentId = studentId;
      isAdmin = true;
    }

    if (resetCount) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "غير مصرح بتصفير المحاولات" },
          { status: 403 }
        );
      }
      await resetParentVerificationLimits(targetStudentId);
      return NextResponse.json({
        success: true,
        message: "تم تصفير عداد المحاولات وفك الحظر عن الطالب بنجاح",
      });
    }

    if (!parentPhone || typeof parentPhone !== "string") {
      return NextResponse.json(
        { error: "رقم هاتف ولي الأمر مطلوب" },
        { status: 400 }
      );
    }

    const trimmedPhone = parentPhone.trim();
    if (trimmedPhone.length === 0 || trimmedPhone.length > MAX_PHONE_LEN) {
      return NextResponse.json(
        { error: "رقم الهاتف غير صالح" },
        { status: 400 }
      );
    }

    // Security fix: non-admin users must NOT be able to bypass the same-phone
    // check by sending allowSamePhone: true from the client.
    const effectiveAllowSamePhone = isAdmin ? (allowSamePhone ?? false) : false;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await reissueParentToken(
      targetStudentId,
      trimmedPhone,
      ip,
      userAgent,
      {
        allowSamePhone: effectiveAllowSamePhone,
        bypassRateLimit: isAdmin,
        resetLimits: isAdmin,
      }
    );

    const dispatchSuccess = result.dispatchResult?.success ?? false;
    const dispatchError = result.dispatchResult?.error;

    const msg = dispatchSuccess
      ? "تم إرسال رابط متابعة جديد لولي الأمر عبر الواتساب بنجاح"
      : `تم توليد وتحديث الرابط بنجاح. تنبيه: تعذر الإرسال عبر الواتساب (${dispatchError || "محرك الواتساب غير متصل"})`;

    return NextResponse.json({
      success: true,
      message: msg,
      dispatchSuccess,
      dispatchError,
    });
  } catch (err) {
    // Do not leak internal error messages to the client
    console.error("[parent-phone] error:", err);
    return NextResponse.json(
      { error: "تعذر إرسال الرابط" },
      { status: 400 }
    );
  }
}
