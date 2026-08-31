import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExpensesFromDb, saveExpensesToDb } from "@/lib/money-control";

/** Superadmin/Admin: Delete an expense by ID. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["superadmin", "admin", "staff"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "معرف المصروف مطلوب" }, { status: 400 });
    }

    const expenses = await getExpensesFromDb();
    const updated = expenses.filter((e) => e.id !== id);

    if (updated.length === expenses.length) {
      return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
    }

    await saveExpensesToDb(updated);

    return NextResponse.json({
      success: true,
      totalExpenses: updated.reduce((s, e) => s + (e.amount || 0), 0),
    });
  } catch (error) {
    console.error("[money-control/expenses DELETE] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حذف المصروف" }, { status: 500 });
  }
}
