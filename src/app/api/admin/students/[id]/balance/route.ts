import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST — credit or debit a student's balance (admin/superadmin) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
  if (!session || !["admin", "superadmin"].includes(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id: studentId } = await params;
  const { amount, note } = await req.json() as { amount: number; note?: string };

  if (!amount || amount === 0) return NextResponse.json({ error: "المبلغ مطلوب" }, { status: 400 });

  const student = await prisma.user.findUnique({
    where: { id: studentId, role: "student", isDeleted: false },
    select: { id: true, name: true, balance: true },
  });
  if (!student) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });

  const currentBalance = student.balance ?? 0;
  if (amount < 0 && currentBalance + amount < 0) {
    return NextResponse.json({ error: "الرصيد غير كافٍ للخصم" }, { status: 400 });
  }

  const newBalance = +(currentBalance + amount).toFixed(2);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: studentId },
      data: { balance: newBalance },
    }),
    prisma.balanceTransaction.create({
      data: {
        userId:  studentId,
        type:    amount > 0 ? "credit_admin" : "debit_admin",
        amount,
        note:    note ?? (amount > 0 ? "إضافة رصيد من الإدارة" : "خصم رصيد من الإدارة"),
        adminId: session.id,
      },
    }),
  ]);

  const updated = await prisma.user.findUnique({ where: { id: studentId }, select: { balance: true } });

  return NextResponse.json({
    success: true,
    newBalance: updated?.balance ?? 0,
    message: `${amount > 0 ? "تم إضافة" : "تم خصم"} ${Math.abs(amount)} جنيه ${amount > 0 ? "إلى" : "من"} رصيد ${student.name} — الرصيد الآن ${newBalance} جنيه`,
  });
}
