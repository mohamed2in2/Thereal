import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reconcileStaleReservations, getAllAccountsWithStats } from "@/lib/vdocipher-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "superadmin" && session.role !== "admin")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const expiredReservations = await reconcileStaleReservations();
    const updatedAccounts = await getAllAccountsWithStats();

    return NextResponse.json({
      success: true,
      expiredReservationsCount: expiredReservations,
      accounts: updatedAccounts,
      message: `تم إجراء الفحص الدوري بنجاح. تم تحرير وإلغاء ${expiredReservations} حجز منتهي.`,
    });
  } catch (error: any) {
    console.error("[Superadmin Reconcile VdoCipher] Error:", error);
    return NextResponse.json(
      { error: error.message || "تعذر إجراء المزامنة" },
      { status: 500 }
    );
  }
}
