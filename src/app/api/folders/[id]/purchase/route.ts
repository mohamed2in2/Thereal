import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acquireAdvisoryLock } from "@/lib/distributed-lock";

import { processTeacherAttribution } from "@/lib/referral";

/**
 * POST /api/folders/[id]/purchase
 * Student purchases access to a specific folder.
 * Deducts balance (or marks as free if folder.price === 0).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "student")
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const { id: folderId } = await params;
  const reqBody = await req.json().catch(() => ({}));
  const promoCodeInput = reqBody.promoCode || reqBody.promo_code;

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      // Acquire unified advisory lock on student wallet
      await acquireAdvisoryLock(`spend:${session.id}`, tx);

      const folder = await tx.folder.findUnique({
        where: { id: folderId },
        include: { course: { select: { id: true, teacherId: true, title: true } } },
      });

      if (!folder) throw new Error("NOT_FOUND");

      if (!folder.isPurchasable) throw new Error("NOT_PURCHASABLE");

      // Prevent double purchase
      const existing = await tx.folderPurchase.findUnique({
        where: { studentId_folderId: { studentId: session.id, folderId } },
      });
      if (existing) throw new Error("ALREADY_OWNED");

      const price = folder.price ?? 0;

      if (price > 0) {
        // Deduct balance atomically with conditional updateMany
        const claim = await tx.user.updateMany({
          where: { id: session.id, balance: { gte: price } },
          data: { balance: { decrement: price } },
        });

        if (claim.count === 0) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Add ledger entry
        await tx.balanceTransaction.create({
          data: {
            userId: session.id,
            type: "debit_course",
            amount: -price,
            note: `شراء مجلد: ${folder.name}`,
          },
        });
      }

      // Create purchase record
      const res = await tx.folderPurchase.create({
        data: { studentId: session.id, folderId, price },
      });

      // Process Teacher Referral Attribution
      await processTeacherAttribution({
        studentId: session.id,
        teacherIdOfContent: folder.course.teacherId,
        amount: price,
        purchaseType: "FOLDER",
        folderId,
        courseId: folder.course.id,
        promoCodeInput,
        tx,
      });

      return res;
    });

    return NextResponse.json({ purchase, message: "تم شراء المجلد بنجاح" }, { status: 201 });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "المجلد غير موجود" }, { status: 404 });
    }
    if (error.message === "NOT_PURCHASABLE") {
      return NextResponse.json(
        { error: "هذا المجلد غير متاح للشراء منفرداً — يمكنك شراء الكورس كاملاً بكود وصول" },
        { status: 403 }
      );
    }
    if (error.message === "ALREADY_OWNED") {
      return NextResponse.json({ error: "لقد اشتريت هذا المجلد بالفعل", alreadyOwned: true });
    }
    if (error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "رصيدك غير كافٍ" }, { status: 402 });
    }
    console.error("[folder purchase] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

/** GET /api/folders/[id]/purchase — check if student owns this folder */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ owned: false });

  const { id: folderId } = await params;
  const purchase = await prisma.folderPurchase.findUnique({
    where: { studentId_folderId: { studentId: session.id, folderId } },
  });
  return NextResponse.json({ owned: !!purchase });
}
