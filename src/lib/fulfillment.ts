import { Prisma } from "@prisma/client";
import { processTeacherAttribution } from "@/lib/referral";
import { ReferralService } from "@/services/referral/ReferralService";
import { randomBytes } from "crypto";

export interface FulfillmentResult {
  fulfilled: boolean;
  itemType?: "teacher_sub" | "course" | "folder" | "plan";
  itemName?: string;
  message?: string;
  error?: string;
}

/**
 * Parses item metadata stored inside a payment ledger note string.
 * Example note: "sha7nawy_ref:REF123|base:180|total:183.6|itemType:teacher_sub|teacherId:usr_1|planType:monthly|grade:sec_1|lang:arabic"
 */
export function parsePaymentNoteMetadata(note: string | null | undefined): Record<string, string> {
  if (!note) return {};
  const meta: Record<string, string> = {};
  const parts = note.split("|");
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx > 0) {
      const key = part.substring(0, colonIdx).trim();
      const val = part.substring(colonIdx + 1).trim();
      if (key && val) {
        meta[key] = val;
      }
    }
  }
  return meta;
}

/**
 * Fulfills pending purchases (Teacher Subscription, Course, Folder, Study Plan)
 * when a payment transaction is successfully confirmed/credited.
 */
export async function fulfillPendingItemPurchase({
  userId,
  note,
  tx,
}: {
  userId: string;
  note: string;
  tx: Prisma.TransactionClient;
}): Promise<FulfillmentResult> {
  const meta = parsePaymentNoteMetadata(note);
  const itemType = meta.itemType;

  if (!itemType) {
    return { fulfilled: false, message: "لا ينطبق — عملية شحن رصيد عامة" };
  }

  const baseAmount = meta.base ? parseFloat(meta.base) : 0;
  const now = new Date();

  // 1. Teacher Subscription Auto-Fulfillment
  if (itemType === "teacher_sub" && meta.teacherId && meta.planType) {
    const { teacherId, planType, grade, lang } = meta;
    const isLanguages = lang === "languages" || lang === "english";

    const teacher = await tx.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || teacher.role !== "teacher") {
      return { fulfilled: false, error: "المعلم لم يعد متاحاً للتأكيد الآلي" };
    }

    const teacherName = teacher.teacherProfile?.displayName || teacher.teacherProfile?.slug || teacher.name || "المعلم";
    const monthsMap: Record<string, number> = { monthly: 1, termly: 3, yearly: 6 };
    const months = monthsMap[planType] || 1;

    const planNames: Record<string, string> = {
      monthly: "شهر واحد (1 Month)",
      termly: "3 شهور (3 Months)",
      yearly: "6 شهور (6 Months)",
    };
    const planLabel = `${planNames[planType] || "اشتراك"} ${isLanguages ? "(لغات / إنجليزي)" : "(عربي)"}`;

    const studentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, parentPhone: true, educationalStage: true },
    });

    const targetStage = grade || studentUser?.educationalStage;

    const existingSub = await tx.teacherSubscription.findUnique({
      where: {
        studentId_teacherId_planType: {
          studentId: userId,
          teacherId,
          planType,
        },
      },
      select: { expiresAt: true, status: true },
    });

    const baseDate =
      existingSub && existingSub.status === "active" && existingSub.expiresAt && existingSub.expiresAt > now
        ? existingSub.expiresAt
        : now;

    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + months);

    await tx.teacherSubscription.upsert({
      where: {
        studentId_teacherId_planType: {
          studentId: userId,
          teacherId,
          planType,
        },
      },
      create: {
        studentId: userId,
        teacherId,
        planType,
        planLabel,
        amount: baseAmount,
        educationalStage: targetStage,
        studentName: studentUser?.name,
        studentPhone: studentUser?.phone,
        parentPhone: studentUser?.parentPhone,
        status: "active",
        expiresAt,
      },
      update: {
        planLabel,
        amount: baseAmount,
        educationalStage: targetStage,
        studentName: studentUser?.name,
        studentPhone: studentUser?.phone,
        parentPhone: studentUser?.parentPhone,
        status: "active",
        expiresAt,
      },
    });

    if (baseAmount > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: baseAmount } },
      });

      await tx.balanceTransaction.create({
        data: {
          userId,
          type: "debit_purchase",
          amount: -baseAmount,
          note: `تفعيل تلقائي لحجز اشتراك (${planLabel}) - أستاذ ${teacherName}`,
        },
      });
    }

    void ReferralService.qualifyAndRewardReferral(userId, `sub:${teacherId}:${planType}`).catch(() => {});

    return {
      fulfilled: true,
      itemType: "teacher_sub",
      itemName: `اشتراك معلم: أستاذ ${teacherName}`,
      message: `تم حجز وتفعيل اشتراك المعلم (${teacherName}) تلقائياً بنجاح! 🎉`,
    };
  }

  // 2. Course Auto-Fulfillment
  if (itemType === "course" && meta.courseId) {
    const courseId = meta.courseId;
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, teacherId: true },
    });

    if (course) {
      const existing = await tx.accessCode.findFirst({
        where: { courseId, studentId: userId },
        select: { id: true },
      });

      if (!existing) {
        const code = `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
        await tx.accessCode.create({
          data: { code, courseId, studentId: userId, isActive: true, usedAt: now },
        });

        if (baseAmount > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: baseAmount } },
          });

          await tx.balanceTransaction.create({
            data: {
              userId,
              type: "debit_course",
              amount: -baseAmount,
              note: `تفعيل تلقائي لشراء كورس: ${course.title}`,
            },
          });
        }

        await processTeacherAttribution({
          studentId: userId,
          teacherIdOfContent: course.teacherId,
          amount: baseAmount,
          purchaseType: "COURSE",
          courseId: course.id,
          tx,
        });
      }

      return {
        fulfilled: true,
        itemType: "course",
        itemName: course.title,
        message: `تم شراء وتسجيل «${course.title}» تلقائياً بنجاح! 🎉`,
      };
    }
  }

  // 3. Folder Auto-Fulfillment
  if (itemType === "folder" && meta.folderId) {
    const folderId = meta.folderId;
    const folder = await tx.folder.findUnique({
      where: { id: folderId },
      include: { course: { select: { id: true, teacherId: true, title: true } } },
    });

    if (folder && folder.isPurchasable) {
      const existing = await tx.folderPurchase.findUnique({
        where: { studentId_folderId: { studentId: userId, folderId } },
      });

      if (!existing) {
        await tx.folderPurchase.create({
          data: { studentId: userId, folderId, price: baseAmount },
        });

        if (baseAmount > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: baseAmount } },
          });

          await tx.balanceTransaction.create({
            data: {
              userId,
              type: "debit_course",
              amount: -baseAmount,
              note: `تفعيل تلقائي لشراء مجلد: ${folder.name}`,
            },
          });
        }

        await processTeacherAttribution({
          studentId: userId,
          teacherIdOfContent: folder.course.teacherId,
          amount: baseAmount,
          purchaseType: "FOLDER",
          folderId,
          courseId: folder.course.id,
          tx,
        });
      }

      return {
        fulfilled: true,
        itemType: "folder",
        itemName: folder.name,
        message: `تم شراء محاضرة «${folder.name}» تلقائياً بنجاح! 🎉`,
      };
    }
  }

  // 4. Study Plan Auto-Fulfillment
  if (itemType === "plan" && meta.planId) {
    const planId = meta.planId;
    const plan = await tx.plan.findUnique({ where: { id: planId } });

    if (plan && plan.status === "published") {
      const existing = await tx.planEnrollment.findUnique({
        where: { planId_studentId: { planId, studentId: userId } },
      });

      if (!existing) {
        const durationDays = plan.durationDays > 0 ? plan.durationDays : 365;
        await tx.planEnrollment.create({
          data: {
            planId,
            studentId: userId,
            pricePaid: baseAmount,
            expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          },
        });

        if (baseAmount > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: baseAmount } },
          });

          await tx.balanceTransaction.create({
            data: {
              userId,
              type: "debit_purchase",
              amount: -baseAmount,
              note: `تفعيل تلقائي لشراء الخطة الدراسية: ${plan.title}`,
            },
          });
        }
      }

      return {
        fulfilled: true,
        itemType: "plan",
        itemName: plan.title,
        message: `تم التسجيل في خطة «${plan.title}» تلقائياً بنجاح! 🎉`,
      };
    }
  }

  return { fulfilled: false, message: "لم يتم التعرف على نوع المحتوى المستهدف" };
}
