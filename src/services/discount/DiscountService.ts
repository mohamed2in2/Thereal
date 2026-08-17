import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export type PurchaseType = "COURSE" | "FOLDER" | "VIDEO" | "PLAN" | "TEACHER_SUB";

export interface ValidateDiscountParams {
  code: string;
  studentId: string;
  purchaseType: PurchaseType;
  targetId: string; // courseId, folderId, videoId, planId, or teacherId
  basePrice: number;
  paymentMethod?: string;
  tx?: any;
}

export interface DiscountValidationResult {
  valid: boolean;
  error?: string;
  discountCode?: {
    id: string;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    scope: string;
    targetId: string | null;
  };
  pricing?: {
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  };
}

export class DiscountService {
  /**
   * Normalizes a discount code string for safe matching
   */
  static normalizeCode(code: string): string {
    return (code || "").trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, "");
  }

  /**
   * Calculates the discounted final price with non-negative guarantee
   */
  static calculateDiscountedPrice(
    basePrice: number,
    discountType: "PERCENTAGE" | "FIXED_AMOUNT" | string,
    discountValue: number
  ): { originalPrice: number; discountAmount: number; finalPrice: number } {
    const originalPrice = Math.max(0, Number(basePrice) || 0);
    const value = Math.max(0, Number(discountValue) || 0);

    let discountAmount = 0;
    if (discountType === "PERCENTAGE") {
      discountAmount = Math.round((originalPrice * (Math.min(100, value) / 100)) * 100) / 100;
    } else {
      // FIXED_AMOUNT
      discountAmount = Math.min(originalPrice, value);
    }

    const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

    return {
      originalPrice,
      discountAmount,
      finalPrice,
    };
  }

  /**
   * Validates a discount code server-side against all security and eligibility rules
   */
  static async validateDiscountCode(
    params: ValidateDiscountParams
  ): Promise<DiscountValidationResult> {
    const client = params.tx || prisma;
    const cleanCode = this.normalizeCode(params.code);

    if (!cleanCode) {
      return { valid: false, error: "كود الخصم مطلوب" };
    }

    const discount = await client.discountCode.findUnique({
      where: { code: cleanCode },
    });

    if (!discount) {
      return { valid: false, error: "كود الخصم غير صحيح أو غير موجود" };
    }

    if (!discount.isActive) {
      return { valid: false, error: "كود الخصم غير مفعّل حالياً" };
    }

    const now = new Date();
    if (discount.expiresAt && discount.expiresAt < now) {
      return { valid: false, error: "كود الخصم منتهي الصلاحية" };
    }

    // Check global usage limit
    if (discount.maxTotalUses !== null && discount.maxTotalUses !== undefined) {
      const totalUsages = await client.discountCodeUsage.count({
        where: { discountCodeId: discount.id },
      });
      if (totalUsages >= discount.maxTotalUses) {
        return { valid: false, error: "تم استنفاد الحد الأقصى لاستخدام كود الخصم هذا" };
      }
    }

    // Check per-student usage limit
    if (discount.maxUsesPerStudent > 0 && params.studentId) {
      const studentUsages = await client.discountCodeUsage.count({
        where: {
          discountCodeId: discount.id,
          studentId: params.studentId,
        },
      });
      if (studentUsages >= discount.maxUsesPerStudent) {
        return { valid: false, error: "لقد استخدمت كود الخصم هذا بالحد الأقصى المسموح به لحسابك" };
      }
    }

    // Check payment method compatibility if configured
    if (discount.allowedPaymentMethods && params.paymentMethod) {
      try {
        const allowedMethods: string[] = JSON.parse(discount.allowedPaymentMethods);
        if (Array.isArray(allowedMethods) && allowedMethods.length > 0) {
          // For split payment, wallet_balance or the selected gateway method should be allowed
          const methodToCheck = params.paymentMethod;
          const isAllowed =
            allowedMethods.includes(methodToCheck) ||
            (methodToCheck === "split" &&
              (allowedMethods.includes("wallet_balance") || allowedMethods.some((m) => m !== "wallet_balance")));

          if (!isAllowed) {
            return {
              valid: false,
              error: "كود الخصم غير صالح مع طريقة الدفع المختارة",
            };
          }
        }
      } catch (e) {
        console.error("[DiscountService] Error parsing allowedPaymentMethods:", e);
      }
    }

    // Validate Scope Eligibility
    const scope = discount.scope || "PLATFORM_WIDE";
    if (scope !== "PLATFORM_WIDE") {
      const targetId = params.targetId;

      if (!discount.targetId) {
        return { valid: false, error: "إعدادات كود الخصم غير مكتملة" };
      }

      if (scope === "COURSE") {
        if (params.purchaseType !== "COURSE" || targetId !== discount.targetId) {
          return { valid: false, error: "كود الخصم هذا مخصص لكورس محدد فقط" };
        }
      } else if (scope === "FOLDER") {
        if (params.purchaseType !== "FOLDER" || targetId !== discount.targetId) {
          return { valid: false, error: "كود الخصم هذا مخصص لمحاضرة محددة فقط" };
        }
      } else if (scope === "VIDEO") {
        if (params.purchaseType !== "VIDEO" || targetId !== discount.targetId) {
          return { valid: false, error: "كود الخصم هذا مخصص لدرس محدد فقط" };
        }
      } else if (scope === "PLAN") {
        if (params.purchaseType !== "PLAN" || targetId !== discount.targetId) {
          return { valid: false, error: "كود الخصم هذا مخصص لخطة دراسية محددة فقط" };
        }
      } else if (scope === "TEACHER") {
        const teacherId = discount.targetId;
        let isTeacherMatch = false;

        if (params.purchaseType === "TEACHER_SUB") {
          isTeacherMatch = targetId === teacherId;
        } else if (params.purchaseType === "COURSE") {
          const course = await client.course.findUnique({
            where: { id: targetId },
            select: { teacherId: true },
          });
          isTeacherMatch = course?.teacherId === teacherId;
        } else if (params.purchaseType === "FOLDER") {
          const folder = await client.folder.findUnique({
            where: { id: targetId },
            select: { course: { select: { teacherId: true } } },
          });
          isTeacherMatch = folder?.course?.teacherId === teacherId;
        } else if (params.purchaseType === "VIDEO") {
          const video = await client.video.findUnique({
            where: { id: targetId },
            select: { course: { select: { teacherId: true } } },
          });
          isTeacherMatch = video?.course?.teacherId === teacherId;
        } else if (params.purchaseType === "PLAN") {
          const plan = await client.plan.findUnique({
            where: { id: targetId },
            select: { createdById: true },
          });
          isTeacherMatch = plan?.createdById === teacherId;
        }

        if (!isTeacherMatch) {
          return { valid: false, error: "كود الخصم هذا مخصص لمحتوى معلم آخر" };
        }
      }
    }

    const pricing = this.calculateDiscountedPrice(
      params.basePrice,
      discount.discountType,
      discount.discountValue
    );

    return {
      valid: true,
      discountCode: {
        id: discount.id,
        code: discount.code,
        discountType: discount.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
        discountValue: discount.discountValue,
        scope: discount.scope,
        targetId: discount.targetId,
      },
      pricing,
    };
  }

  /**
   * Records the usage of a discount code within an active transaction
   */
  static async recordUsage(
    params: {
      discountCodeId: string;
      studentId: string;
      purchaseType: PurchaseType;
      purchaseTargetId: string;
      originalPrice: number;
      discountAmount: number;
      finalPrice: number;
      paymentMethod: string;
    },
    tx: any
  ) {
    return tx.discountCodeUsage.create({
      data: {
        discountCodeId: params.discountCodeId,
        studentId: params.studentId,
        purchaseType: params.purchaseType,
        purchaseTargetId: params.purchaseTargetId,
        originalPrice: params.originalPrice,
        discountAmount: params.discountAmount,
        finalPrice: params.finalPrice,
        paymentMethod: params.paymentMethod,
      },
    });
  }
}
