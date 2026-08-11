import { Prisma } from "@/generated/prisma/client";
import { PurchaseService } from "@/services/purchase/PurchaseService";
import { PurchaseType } from "@/services/discount/DiscountService";

export interface FulfillmentResult {
  fulfilled: boolean;
  itemType?: "teacher_sub" | "course" | "folder" | "video" | "plan";
  itemName?: string;
  message?: string;
  error?: string;
}

/**
 * Parses item metadata stored inside a payment ledger note string.
 * Example note: "sha7nawy_ref:REF123|base:180|total:183.6|itemType:teacher_sub|teacherId:usr_1|planType:monthly|grade:sec_1|lang:arabic|discount:CODE20|splitWallet:50"
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
 * Fulfills pending purchases (Teacher Subscription, Course, Folder, Video, Study Plan)
 * when a payment transaction is successfully confirmed/credited via gateway webhook.
 * Seamlessly handles direct gateway payments, discount codes, and split-funding contributions.
 */
export async function fulfillPendingItemPurchase({
  userId,
  note,
  tx,
}: {
  userId: string;
  note: string;
  tx: any;
}): Promise<FulfillmentResult> {
  const meta = parsePaymentNoteMetadata(note);
  const itemType = meta.itemType;

  if (!itemType) {
    return { fulfilled: false, message: "لا ينطبق — عملية شحن رصيد عامة" };
  }

  const baseAmount = meta.base ? parseFloat(meta.base) : 0;
  const splitWallet = meta.splitWallet ? parseFloat(meta.splitWallet) : 0;
  const discountCode = meta.discount || meta.discountCode || undefined;
  const promoCodeInput = meta.promo || meta.promoCode || undefined;

  // Handle Split Funding if splitWallet was recorded
  if (splitWallet > 0) {
    let targetId = "";
    let pType: PurchaseType = "COURSE";

    if (itemType === "course" && meta.courseId) {
      targetId = meta.courseId;
      pType = "COURSE";
    } else if (itemType === "folder" && meta.folderId) {
      targetId = meta.folderId;
      pType = "FOLDER";
    } else if (itemType === "video" && meta.videoId) {
      targetId = meta.videoId;
      pType = "VIDEO";
    } else if (itemType === "plan" && meta.planId) {
      targetId = meta.planId;
      pType = "PLAN";
    } else if (itemType === "teacher_sub" && meta.teacherId) {
      targetId = meta.teacherId;
      pType = "TEACHER_SUB";
    }

    if (targetId) {
      const splitRes = await PurchaseService.executeSplitFulfillment({
        studentId: userId,
        purchaseType: pType,
        targetId,
        walletDeduction: splitWallet,
        gatewayAmount: baseAmount,
        discountCode,
        promoCodeInput,
        planType: meta.planType,
        studentGrade: meta.grade,
        languageTrack: meta.lang,
        tx,
      });

      if (splitRes.success) {
        if (baseAmount > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { decrement: baseAmount } },
          });

          await tx.balanceTransaction.create({
            data: {
              userId,
              type: pType === "COURSE" || pType === "FOLDER" || pType === "VIDEO" ? "debit_course" : "debit_purchase",
              amount: -baseAmount,
              note: `سداد حصة بوابة الدفع في الشراء المجمع: ${splitRes.itemTitle || targetId}`,
            },
          });
        }

        return {
          fulfilled: true,
          itemType: itemType as any,
          itemName: splitRes.itemTitle,
          message: splitRes.message || "تم إتمام الشراء المجمع وتفعيل المحتوى بنجاح!",
        };
      }
      return {
        fulfilled: false,
        error: splitRes.error || "فشل إتمام الشراء المجمع",
      };
    }
  }

  // 1. Teacher Subscription Auto-Fulfillment
  if (itemType === "teacher_sub" && meta.teacherId && meta.planType) {
    const res = await PurchaseService.purchaseTeacherSubscription({
      studentId: userId,
      teacherId: meta.teacherId,
      planType: meta.planType,
      languageTrack: meta.lang,
      studentGrade: meta.grade,
      discountCode,
      paymentMethod: "gateway_direct",
      tx,
    });

    if (res.success) {
      // Deduct balance that was credited for the payment
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
            note: `تفعيل تلقائي لحجز اشتراك (${res.itemTitle || "معلم"})`,
          },
        });
      }

      return {
        fulfilled: true,
        itemType: "teacher_sub",
        itemName: res.itemTitle,
        message: res.message || "تم حجز وتفعيل اشتراك المعلم تلقائياً بنجاح! 🎉",
      };
    }

    return { fulfilled: false, error: res.error };
  }

  // 2. Course Auto-Fulfillment
  if (itemType === "course" && meta.courseId) {
    const res = await PurchaseService.purchaseCourse({
      studentId: userId,
      courseId: meta.courseId,
      discountCode,
      promoCodeInput,
      paymentMethod: "gateway_direct",
      tx,
    });

    if (res.success) {
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
            note: `تفعيل تلقائي لشراء كورس: ${res.itemTitle || meta.courseId}`,
          },
        });
      }

      return {
        fulfilled: true,
        itemType: "course",
        itemName: res.itemTitle,
        message: res.message || `تم تفعيل الكورس تلقائياً بنجاح! 🎉`,
      };
    }

    return { fulfilled: false, error: res.error };
  }

  // 3. Folder Auto-Fulfillment
  if (itemType === "folder" && meta.folderId) {
    const res = await PurchaseService.purchaseFolder({
      studentId: userId,
      folderId: meta.folderId,
      discountCode,
      promoCodeInput,
      paymentMethod: "gateway_direct",
      tx,
    });

    if (res.success) {
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
            note: `تفعيل تلقائي لشراء محاضرة: ${res.itemTitle || meta.folderId}`,
          },
        });
      }

      return {
        fulfilled: true,
        itemType: "folder",
        itemName: res.itemTitle,
        message: res.message || `تم تفعيل المحاضرة تلقائياً بنجاح! 🎉`,
      };
    }

    return { fulfilled: false, error: res.error };
  }

  // 4. Video Auto-Fulfillment
  if (itemType === "video" && meta.videoId) {
    const res = await PurchaseService.purchaseVideo({
      studentId: userId,
      videoId: meta.videoId,
      discountCode,
      promoCodeInput,
      paymentMethod: "gateway_direct",
      tx,
    });

    if (res.success) {
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
            note: `تفعيل تلقائي لشراء درس: ${res.itemTitle || meta.videoId}`,
          },
        });
      }

      return {
        fulfilled: true,
        itemType: "video",
        itemName: res.itemTitle,
        message: res.message || `تم تفعيل الدرس تلقائياً بنجاح! 🎉`,
      };
    }

    return { fulfilled: false, error: res.error };
  }

  // 5. Study Plan Auto-Fulfillment
  if (itemType === "plan" && meta.planId) {
    const res = await PurchaseService.purchasePlan({
      studentId: userId,
      planId: meta.planId,
      discountCode,
      paymentMethod: "gateway_direct",
      tx,
    });

    if (res.success) {
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
            note: `تفعيل تلقائي لشراء الخطة الدراسية: ${res.itemTitle || meta.planId}`,
          },
        });
      }

      return {
        fulfilled: true,
        itemType: "plan",
        itemName: res.itemTitle,
        message: res.message || `تم التسجيل في الخطة الدراسية تلقائياً بنجاح! 🎉`,
      };
    }

    return { fulfilled: false, error: res.error };
  }

  return { fulfilled: false, message: "لم يتم التعرف على نوع المحتوى المستهدف" };
}
