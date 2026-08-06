import { NextRequest, NextResponse } from "next/server";
import {
  PAYMENT_CATEGORIES,
  listPaymentMethods,
  filterPaymentMethods,
  PaymentMethodCategory,
} from "@/lib/payment-methods";

/**
 * GET /api/payments/methods
 * Dynamic API returning auto-generated payment methods and categories.
 * Supports query params:
 * - category: "all" | "wallet" | "instant" | "kiosk" | "card" | "balance" | "voucher" | "bank"
 * - search: string query
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category") as PaymentMethodCategory | "all" | null;
    const searchQuery = searchParams.get("search") || undefined;

    const methods = filterPaymentMethods(categoryParam || "all", searchQuery);

    return NextResponse.json({
      success: true,
      totalCount: methods.length,
      categories: PAYMENT_CATEGORIES,
      methods,
    });
  } catch (error: any) {
    console.error("[Payment Methods API] Error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر جلب طرق الدفع المتاحة" },
      { status: 500 }
    );
  }
}
