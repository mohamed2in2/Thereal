import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/auth";
import { acquireAdvisoryLock } from "@/lib/distributed-lock";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getStudentSession();
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan || plan.status !== "published") {
      return NextResponse.json({ error: "الخطة غير متاحة" }, { status: 404 });
    }

    let effectivePrice = plan.isPaid ? plan.price : 0;
    if (plan.isPaid && plan.discountPrice !== null && plan.discountExpiresAt && new Date(plan.discountExpiresAt) > new Date()) {
      effectivePrice = plan.discountPrice;
    }

    const student = await prisma.user.findUnique({
      where: { id: session.id },
      select: { educationalStage: true, balance: true }
    });

    if (student?.educationalStage && plan.educationalStage && student.educationalStage !== plan.educationalStage) {
      return NextResponse.json({ error: "هذه الخطة مخصصة لمرحلة دراسية مختلفة عن مرحلتك" }, { status: 400 });
    }

    // Run transaction: serialize with spend lock, check enrollment, deduct balance, create enrollment
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Acquire unified advisory lock on student wallet
        await acquireAdvisoryLock(`spend:${session.id}`, tx);

        // 2. Check already enrolled inside the transaction
        const alreadyEnrolled = await tx.planEnrollment.findUnique({
          where: { planId_studentId: { planId: id, studentId: session.id } },
        });
        if (alreadyEnrolled) {
          throw new Error("ALREADY_ENROLLED");
        }

        // 3. Deduct balance atomically if plan is paid
        if (effectivePrice > 0) {
          const claim = await tx.user.updateMany({
            where: { id: session.id, balance: { gte: effectivePrice } },
            data: { balance: { decrement: effectivePrice } },
          });

          if (claim.count === 0) {
            throw new Error("INSUFFICIENT_FUNDS");
          }

          await tx.balanceTransaction.create({
            data: {
              userId: session.id,
              type: "debit_purchase",
              amount: -effectivePrice,
              note: `شراء الخطة الدراسية: ${plan.title}`,
            },
          });
        }

        const durationDays = plan.durationDays > 0 ? plan.durationDays : 365;
        await tx.planEnrollment.create({
          data: {
            planId: id,
            studentId: session.id,
            pricePaid: effectivePrice,
            expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          },
        });
      });

      return NextResponse.json({ success: true, message: "تم الاشتراك في الخطة بنجاح" });
    } catch (e: any) {
      if (e.message === "ALREADY_ENROLLED") {
        return NextResponse.json({ error: "أنت مسجل بالفعل في هذه الخطة" }, { status: 400 });
      }
      if (e.message === "INSUFFICIENT_FUNDS") {
        return NextResponse.json(
          { code: "INSUFFICIENT_FUNDS", error: "الرصيد غير كافٍ لإتمام العملية", effectivePrice },
          { status: 400 }
        );
      }
      throw e;
    }
  } catch (error) {
    console.error("Plan purchase error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء الشراء" }, { status: 500 });
  }
}
