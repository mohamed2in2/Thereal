import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acquireAdvisoryLock } from "@/lib/distributed-lock";

import { processTeacherAttribution } from "@/lib/referral";

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

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      // Acquire transaction-scoped advisory lock to serialize purchases for the user
      await acquireAdvisoryLock(`purchase-video-${session.id}`, tx);

      const video = await tx.video.findUnique({
        where: { id: videoId },
        include: { folder: { include: { course: { select: { id: true, teacherId: true, title: true } } } } },
      });

      if (!video) throw new Error("NOT_FOUND");

      // Prevent double purchase inside the transaction
      const existing = await tx.videoPurchase.findUnique({
        where: { studentId_videoId: { studentId: session.id, videoId } },
      });
      if (existing) throw new Error("ALREADY_OWNED");

      const price = video.price ?? 0;

      if (price > 0) {
        const student = await tx.user.findUnique({
          where: { id: session.id },
          select: { balance: true },
        });
        if (!student || (student.balance ?? 0) < price) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Deduct balance atomically
        await tx.user.update({
          where: { id: session.id },
          data: { balance: { decrement: price } },
        });

        // Add ledger entry
        await tx.balanceTransaction.create({
          data: {
            userId: session.id,
            type: "debit_course",
            amount: -price,
            note: `شراء درس: ${video.title}`,
          },
        });
      }

      // Create purchase record
      const res = await tx.videoPurchase.create({
        data: { studentId: session.id, videoId, price },
      });

      // Process Teacher Referral Attribution
      await processTeacherAttribution({
        studentId: session.id,
        teacherIdOfContent: video.folder.course.teacherId,
        amount: price,
        purchaseType: "VIDEO",
        videoId,
        folderId: video.folder.id,
        courseId: video.folder.course.id,
        promoCodeInput,
        tx,
      });

      return res;
    });

    return NextResponse.json({ purchase, message: "تم شراء الدرس بنجاح" }, { status: 201 });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 });
    }
    if (error.message === "ALREADY_OWNED") {
      return NextResponse.json({ error: "لقد اشتريت هذا الدرس بالفعل", alreadyOwned: true });
    }
    if (error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "رصيدك غير كافٍ" }, { status: 402 });
    }
    console.error("[video purchase] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
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
