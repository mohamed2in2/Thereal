import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PurchaseService } from "@/services/purchase/PurchaseService";

/**
 * POST /api/videos/[id]/purchase
 * Student purchases access to a single video/lesson.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "student")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id: videoId } = await params;
  const reqBody = await req.json().catch(() => ({}));
  const promoCodeInput = reqBody.promoCode || reqBody.promo_code;
  const discountCode = reqBody.discountCode || reqBody.discount_code;

  const result = await PurchaseService.purchaseVideo({
    studentId: session.id,
    videoId,
    discountCode,
    promoCodeInput,
    paymentMethod: "wallet_balance",
  });

  if (!result.success) {
    if (result.alreadyOwned) {
      return NextResponse.json({ error: "لقد اشتريت هذا الدرس بالفعل", alreadyOwned: true }, { status: 400 });
    }
    if (result.insufficientFunds) {
      return NextResponse.json(
        {
          error: result.error,
          insufficientFunds: true,
          requiredAmount: result.requiredAmount,
          missingAmount: result.missingAmount,
        },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: result.error || "حدث خطأ داخلي" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    videoId,
    videoTitle: result.itemTitle,
    originalPrice: result.originalPrice,
    discountAmount: result.discountAmount,
    charged: result.finalPrice,
    newBalance: result.newBalance,
    message: result.message || "تم شراء الدرس بنجاح",
  }, { status: 201 });
}

/** GET /api/videos/[id]/purchase — check if student owns this video */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ owned: false });

  const { id: videoId } = await params;
  const purchase = await prisma.videoPurchase.findUnique({
    where: { studentId_videoId: { studentId: session.id, videoId } },
  });
  return NextResponse.json({ owned: !!purchase });
}
