import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { PurchaseService } from "@/services/purchase/PurchaseService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const discountCode = body.discountCode || body.discount_code;

    const result = await PurchaseService.purchasePlan({
      studentId: session.id,
      planId,
      discountCode,
      paymentMethod: "wallet_balance",
    });

    if (!result.success) {
      if (result.alreadyOwned) {
        return NextResponse.json({ error: "أنت مسجل بالفعل في هذه الخطة" }, { status: 400 });
      }
      if (result.insufficientFunds) {
        return NextResponse.json(
          {
            code: "INSUFFICIENT_FUNDS",
            error: result.error || "الرصيد غير كافٍ لإتمام العملية",
            requiredAmount: result.requiredAmount,
            missingAmount: result.missingAmount,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: result.error || "حدث خطأ أثناء الشراء" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      planId,
      planTitle: result.itemTitle,
      originalPrice: result.originalPrice,
      discountAmount: result.discountAmount,
      charged: result.finalPrice,
      newBalance: result.newBalance,
      message: result.message || "تم الاشتراك في الخطة بنجاح",
    });
  } catch (error) {
    console.error("Plan purchase error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء الشراء" }, { status: 500 });
  }
}
