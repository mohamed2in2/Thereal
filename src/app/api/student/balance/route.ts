import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET — current balance + last 20 transactions */
export async function GET() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const [user, rawTransactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }),
    prisma.balanceTransaction.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, amount: true, note: true, createdAt: true },
    }),
  ]);

  const transactions = rawTransactions.map(tx => {
    const isPending = tx.type.toLowerCase().includes("pending");
    let url: string | null = null;
    let ref: string | null = null;
    
    if (tx.note) {
      const urlMatch = tx.note.match(/\|url:(https?:\/\/[^\s|]+)/);
      if (urlMatch) url = urlMatch[1];
      const refMatch = tx.note.match(/(?:shakeout_ref|sha7nawy_ref):([^\s|]+)/);
      if (refMatch) ref = refMatch[1];
    }

    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note,
      createdAt: tx.createdAt,
      isPending,
      status: isPending ? "UNPAID" : "PAID",
      paymentUrl: url,
      reference: ref,
    };
  });

  return NextResponse.json(
    { balance: user?.balance ?? 0, transactions },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** POST — redeem a money code */
export async function POST(req: NextRequest) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { code } = await req.json() as { code?: string };
  if (!code?.trim()) return NextResponse.json({ error: "الكود مطلوب" }, { status: 400 });

  const normalized = code.trim().toUpperCase();

  try {
    const creditedAmount = await prisma.$transaction(async (tx) => {
      const moneyCode = await tx.moneyCode.findUnique({ where: { code: normalized } });
      if (!moneyCode) {
        throw new Error("NOT_FOUND");
      }
      if (moneyCode.isUsed) {
        throw new Error("ALREADY_USED");
      }
      if (moneyCode.expiresAt && moneyCode.expiresAt < new Date()) {
        throw new Error("EXPIRED");
      }

      // Mark used conditionally - ensures that if another request updated it between findUnique and now, this updates 0 rows
      const updateResult = await tx.moneyCode.updateMany({
        where: { id: moneyCode.id, isUsed: false },
        data: { isUsed: true, usedById: session.id, usedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_USED");
      }

      // Atomically increment user's balance
      await tx.user.update({
        where: { id: session.id },
        data: { balance: { increment: moneyCode.amount } },
      });

      // Create ledger entry
      await tx.balanceTransaction.create({
        data: {
          userId: session.id,
          type: "credit_code",
          amount: moneyCode.amount,
          note: `كود: ${normalized}`,
        },
      });

      return moneyCode.amount;
    });

    return NextResponse.json({
      success: true,
      credited: creditedAmount,
      message: `تم إضافة ${creditedAmount} جنيه إلى رصيدك!`,
    });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "الكود غير صحيح" }, { status: 404 });
    }
    if (error.message === "ALREADY_USED") {
      return NextResponse.json({ error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
    }
    if (error.message === "EXPIRED") {
      return NextResponse.json({ error: "الكود منتهي الصلاحية" }, { status: 400 });
    }
    console.error("[balance redemption] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
