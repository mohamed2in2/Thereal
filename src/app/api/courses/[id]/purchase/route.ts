import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

import { acquireAdvisoryLock } from "@/lib/distributed-lock";

import { processTeacherAttribution } from "@/lib/referral";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
  if (session.role !== "student") {
    return NextResponse.json({ error: "هذا الإجراء مخصص للطلاب فقط" }, { status: 403 });
  }

  const { id: courseId } = await params;
  const reqBody = await req.json().catch(() => ({}));
  const promoCodeInput = reqBody.promoCode || reqBody.promo_code;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true, isPaid: true, price: true, discountPercent: true, discountExpiresAt: true },
  });
  if (!course) return NextResponse.json({ error: "الكورس غير موجود" }, { status: 404 });

  // Calculate effective price
  const now = new Date();
  const discountActive =
    course.discountPercent != null &&
    course.discountPercent > 0 &&
    (course.discountExpiresAt == null || course.discountExpiresAt > now);

  const effectivePrice = (() => {
    if (!course.isPaid || !course.price) return 0;
    if (discountActive && course.discountPercent) {
      return +(course.price * (1 - course.discountPercent / 100)).toFixed(2);
    }
    return course.price;
  })();

  if (effectivePrice === 0) {
    return NextResponse.json({ error: "هذا الكورس مجاني — استخدم زر التسجيل المباشر" }, { status: 400 });
  }

  const code = `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    const purchaseResult = await prisma.$transaction(async (tx) => {
      // 1. Acquire unified advisory lock on student wallet
      await acquireAdvisoryLock(`spend:${session.id}`, tx);

      // 2. Check already enrolled inside the transaction
      const existing = await tx.accessCode.findFirst({
        where: { courseId, studentId: session.id },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_ENROLLED");

      // 3. Update balance atomically using conditional updateMany
      const claim = await tx.user.updateMany({
        where: { id: session.id, balance: { gte: effectivePrice } },
        data: { balance: { decrement: effectivePrice } },
      });

      if (claim.count === 0) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const student = await tx.user.findUnique({
        where: { id: session.id },
        select: { balance: true },
      });

      // 4. Create AccessCode
      await tx.accessCode.create({
        data: { code, courseId, studentId: session.id, isActive: true, usedAt: now },
      });

      // 5. Create BalanceTransaction
      await tx.balanceTransaction.create({
        data: {
          userId: session.id,
          type: "debit_course",
          amount: -effectivePrice,
          note: `شراء كورس: ${course.title}`,
        },
      });

      // 6. Process Teacher Referral Attribution
      await processTeacherAttribution({
        studentId: session.id,
        teacherIdOfContent: course.teacherId,
        amount: effectivePrice,
        purchaseType: "COURSE",
        courseId: course.id,
        promoCodeInput,
        tx,
      });

      return {
        newBalance: student?.balance ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      courseId,
      courseTitle: course.title,
      charged: effectivePrice,
      newBalance: purchaseResult.newBalance,
      message: `تم شراء «${course.title}» بنجاح! خُصم ${effectivePrice} جنيه — رصيدك الآن ${purchaseResult.newBalance} جنيه.`,
    });
  } catch (err: any) {
    if (err.message === "ALREADY_ENROLLED") {
      return NextResponse.json({ error: "أنت مسجّل بالفعل في هذا الكورس" }, { status: 400 });
    }
    if (err.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }
    if (err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json(
        { code: "INSUFFICIENT_FUNDS", error: "رصيدك غير كافٍ لإتمام العملية", effectivePrice },
        { status: 400 }
      );
    }
    throw err;
  }
}
