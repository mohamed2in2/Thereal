import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExpensesFromDb, saveExpensesToDb, ExpenseItem } from "@/lib/money-control";

/** Superadmin/Admin: Add a new expense. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["superadmin", "admin", "staff"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, amount, category, note } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "عنوان المصروف مطلوب" }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "المبلغ يجب أن يكون رقماً موجباً" }, { status: 400 });
    }

    const newExpense: ExpenseItem = {
      id: "exp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: title.trim(),
      amount: numAmount,
      category: category && typeof category === "string" ? category.trim() : "عام",
      note: note && typeof note === "string" ? note.trim() : undefined,
      addedBy: session.name || session.role,
      createdAt: new Date().toISOString(),
    };

    const existingExpenses = await getExpensesFromDb();
    existingExpenses.unshift(newExpense);
    await saveExpensesToDb(existingExpenses);

    return NextResponse.json({
      success: true,
      expense: newExpense,
      totalExpenses: existingExpenses.reduce((s, e) => s + (e.amount || 0), 0),
    });
  } catch (error) {
    console.error("[money-control/expenses POST] error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حفظ المصروف" }, { status: 500 });
  }
}
