import { prisma } from "@/lib/prisma";
import { DiscountService, PurchaseType } from "@/services/discount/DiscountService";

export interface ItemPriceVerificationResult {
  valid: boolean;
  expectedPrice: number;
  originalPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  itemName: string;
  itemType?: PurchaseType;
  targetId?: string;
  error?: string;
}

/**
 * Authoritatively calculates and verifies the real database price of an item.
 * Guarantees that client-supplied `amount` cannot tamper with or lower the price.
 * Supports server-authoritative discount code verification.
 */
export async function verifyAuthoritativePrice(params: {
  amount: number;
  teacherId?: string | null;
  planType?: string | null;
  grade?: string | null;
  languageTrack?: string | null;
  courseId?: string | null;
  folderId?: string | null;
  videoId?: string | null;
  planId?: string | null;
  discountCode?: string | null;
  studentId?: string | null;
  paymentMethod?: string | null;
}): Promise<ItemPriceVerificationResult> {
  const {
    amount,
    teacherId,
    planType,
    grade,
    languageTrack,
    courseId,
    folderId,
    videoId,
    planId,
    discountCode,
    studentId,
    paymentMethod,
  } = params;

  let basePrice = 0;
  let itemName = "شحن رصيد المحفظة";
  let purchaseType: PurchaseType | undefined = undefined;
  let targetId: string | undefined = undefined;

  // 1. Teacher Subscription Price Verification
  if (teacherId && planType) {
    purchaseType = "TEACHER_SUB";
    targetId = teacherId;
    const validPlanTypes = ["monthly", "termly", "yearly"];
    if (!validPlanTypes.includes(planType)) {
      return { valid: false, expectedPrice: 0, itemName: "اشتراك معلم", error: "نوع باقة الاشتراك غير صالح" };
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || teacher.role !== "teacher" || !teacher.teacherProfile) {
      return { valid: false, expectedPrice: 0, itemName: "اشتراك معلم", error: "المعلم غير موجود أو حسابه غير مفعل" };
    }

    const profile = teacher.teacherProfile;
    const rawPriceMap: Record<string, number | null> = {
      monthly: profile.priceMonthly,
      termly: profile.priceTermly,
      yearly: profile.priceYearly,
    };

    let planPrice = rawPriceMap[planType];

    // Check stage-specific pricing override
    if (profile.stagePricing && grade) {
      try {
        const parsedMap = JSON.parse(profile.stagePricing);
        if (parsedMap && parsedMap[grade]) {
          const keyMap: Record<string, string> = {
            monthly: "priceMonthly",
            termly: "priceTermly",
            yearly: "priceYearly",
          };
          const stageVal = parsedMap[grade][keyMap[planType]];
          if (typeof stageVal === "number" && stageVal > 0) {
            planPrice = stageVal;
          }
        }
      } catch {}
    }

    const defaultTeacherPlanPrices: Record<string, number> = {
      monthly: 180,
      termly: 750,
      yearly: 1200,
    };

    if (planPrice === null || planPrice === undefined || planPrice <= 0) {
      planPrice = defaultTeacherPlanPrices[planType] ?? 180;
    }

    const isLanguages = languageTrack === "languages" || languageTrack === "english";
    let languageSurcharge = 0;
    if (isLanguages) {
      let langMonthly = profile.priceLanguagesMonthly ?? 0;
      let langTermly = profile.priceLanguagesTermly ?? 0;
      let langYearly = profile.priceLanguagesYearly ?? 0;

      if (profile.stagePricing && grade) {
        try {
          const parsedMap = JSON.parse(profile.stagePricing);
          if (parsedMap && parsedMap[grade]) {
            const g = parsedMap[grade];
            if (typeof g.priceLanguagesMonthly === "number") langMonthly = g.priceLanguagesMonthly;
            if (typeof g.priceLanguagesTermly === "number") langTermly = g.priceLanguagesTermly;
            if (typeof g.priceLanguagesYearly === "number") langYearly = g.priceLanguagesYearly;
          }
        } catch {}
      }

      if (planType === "monthly") languageSurcharge = langMonthly;
      else if (planType === "termly") languageSurcharge = langTermly;
      else if (planType === "yearly") languageSurcharge = langYearly;
    }

    basePrice = Math.max(planPrice + languageSurcharge, 1);
    const teacherName = profile.displayName || teacher.name;
    itemName = `اشتراك ${planType === "monthly" ? "شهري" : planType === "termly" ? "ترمي" : "سنوي"} (${isLanguages ? "لغات / إنجليزي" : "عربي"}) مع ${teacherName}`;
  }
  // 2. Course Price Verification
  else if (courseId) {
    purchaseType = "COURSE";
    targetId = courseId;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, price: true, discountPercent: true, discountExpiresAt: true, isPaid: true },
    });

    if (!course) {
      return { valid: false, expectedPrice: 0, itemName: "كورس", error: "الكورس المطلوب غير موجود" };
    }

    const coursePrice = course.price ?? 0;
    if (!course.isPaid || coursePrice === 0) {
      return { valid: true, expectedPrice: 0, originalPrice: 0, finalPrice: 0, itemName: course.title, itemType: "COURSE", targetId: courseId };
    }

    let effectivePrice = coursePrice;
    const now = new Date();
    if (course.discountPercent && course.discountExpiresAt && course.discountExpiresAt > now) {
      effectivePrice = Math.round(coursePrice * (1 - course.discountPercent / 100));
    }
    basePrice = effectivePrice;
    itemName = course.title;
  }
  // 3. Folder Price Verification
  else if (folderId) {
    purchaseType = "FOLDER";
    targetId = folderId;
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { name: true, price: true, isPurchasable: true },
    });

    if (!folder) {
      return { valid: false, expectedPrice: 0, itemName: "محاضرة", error: "المحاضرة المطلوبة غير موجودة" };
    }

    if (!folder.isPurchasable) {
      return {
        valid: false,
        expectedPrice: 0,
        itemName: folder.name,
        error: "هذه المحاضرة غير متاحة للشراء منفرداً — يمكنك شراء الكورس كاملاً",
      };
    }

    basePrice = folder.price ?? 0;
    itemName = folder.name;
  }
  // 4. Video Price Verification
  else if (videoId) {
    purchaseType = "VIDEO";
    targetId = videoId;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { title: true, price: true },
    });

    if (!video) {
      return { valid: false, expectedPrice: 0, itemName: "درس", error: "الدرس المطلوب غير موجود" };
    }

    basePrice = video.price ?? 0;
    itemName = video.title;
  }
  // 5. Study Plan Price Verification
  else if (planId) {
    purchaseType = "PLAN";
    targetId = planId;
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { title: true, price: true, discountPrice: true, discountExpiresAt: true, status: true },
    });

    if (!plan) {
      return { valid: false, expectedPrice: 0, itemName: "خطة دراسية", error: "الخطة المطلوبة غير موجودة" };
    }

    const rawPlanPrice = plan.price ?? 0;
    const now = new Date();
    const hasActiveDiscount = plan.discountPrice && plan.discountPrice > 0 && (!plan.discountExpiresAt || plan.discountExpiresAt > now);
    basePrice = hasActiveDiscount ? (plan.discountPrice ?? rawPlanPrice) : rawPlanPrice;
    itemName = plan.title;
  }
  // 6. General Wallet Top-Up
  else {
    return {
      valid: true,
      expectedPrice: amount,
      originalPrice: amount,
      discountAmount: 0,
      finalPrice: amount,
      itemName: "شحن رصيد المحفظة",
    };
  }

  // Calculate Discount if discountCode is supplied
  let finalPrice = basePrice;
  let discountAmount = 0;

  if (discountCode && purchaseType && targetId) {
    const discountValidation = await DiscountService.validateDiscountCode({
      code: discountCode,
      studentId: studentId || "",
      purchaseType,
      targetId,
      basePrice,
      paymentMethod: paymentMethod || undefined,
    });

    if (!discountValidation.valid) {
      return {
        valid: false,
        expectedPrice: basePrice,
        originalPrice: basePrice,
        itemName,
        error: discountValidation.error,
      };
    }

    discountAmount = discountValidation.pricing?.discountAmount ?? 0;
    finalPrice = discountValidation.pricing?.finalPrice ?? basePrice;
  }

  // Reject if client amount is lower than expected final price
  if (amount < finalPrice - 0.01) {
    return {
      valid: false,
      expectedPrice: finalPrice,
      originalPrice: basePrice,
      discountAmount,
      finalPrice,
      itemName,
      itemType: purchaseType,
      targetId,
      error: `المبلغ المطلوب (${amount} جنيه) أقل من السعر الفعلي المعتمد (${finalPrice} جنيه). تم رفض العملية لمنع التلاعب.`,
    };
  }

  return {
    valid: true,
    expectedPrice: finalPrice,
    originalPrice: basePrice,
    discountAmount,
    finalPrice,
    itemName,
    itemType: purchaseType,
    targetId,
  };
}
