import { prisma } from "@/lib/prisma";

export interface ItemPriceVerificationResult {
  valid: boolean;
  expectedPrice: number;
  itemName: string;
  error?: string;
}

/**
 * Authoritatively calculates and verifies the real database price of an item.
 * Guarantees that client-supplied `amount` cannot tamper with or lower the price.
 */
export async function verifyAuthoritativePrice(params: {
  amount: number;
  teacherId?: string | null;
  planType?: string | null;
  grade?: string | null;
  languageTrack?: string | null;
  courseId?: string | null;
  folderId?: string | null;
  planId?: string | null;
}): Promise<ItemPriceVerificationResult> {
  const {
    amount,
    teacherId,
    planType,
    grade,
    languageTrack,
    courseId,
    folderId,
    planId,
  } = params;

  // 1. Teacher Subscription Price Verification
  if (teacherId && planType) {
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
      monthly: profile.priceMonthly ?? 180,
      termly: profile.priceTermly ?? 750,
      yearly: profile.priceYearly ?? 1200,
    };

    let planPrice = rawPriceMap[planType] ?? 180;

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

    const isLanguages = languageTrack === "languages" || languageTrack === "english";
    const monthsMap: Record<string, number> = { monthly: 1, termly: 3, yearly: 6 };
    const months = monthsMap[planType] || 1;
    const langRate = isLanguages ? (profile.priceLanguagesMonthly ?? 50) : 0;
    const languageSurcharge = langRate * months;

    const expectedPrice = Math.max(planPrice + languageSurcharge, 5);
    const teacherName = profile.displayName || teacher.name;
    const itemName = `اشتراك ${planType === "monthly" ? "شهري" : planType === "termly" ? "ترمي" : "سنوي"} مع ${teacherName}`;

    // Reject if client amount is lower than expected
    if (amount < expectedPrice - 0.01) {
      return {
        valid: false,
        expectedPrice,
        itemName,
        error: `المبلغ المطلوب (${amount} جنيه) أقل من السعر الفعلي المعتمد للاشتراك (${expectedPrice} جنيه). تم رفض العملية لمنع التلاعب.`,
      };
    }

    return { valid: true, expectedPrice, itemName };
  }

  // 2. Course Price Verification
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, price: true, discountPercent: true, discountExpiresAt: true, isPaid: true },
    });

    if (!course) {
      return { valid: false, expectedPrice: 0, itemName: "كورس", error: "الكورس المطلوب غير موجود" };
    }

    const coursePrice = course.price ?? 0;
    if (!course.isPaid || coursePrice === 0) {
      return { valid: true, expectedPrice: 0, itemName: course.title };
    }

    let effectivePrice = coursePrice;
    const now = new Date();
    if (course.discountPercent && course.discountExpiresAt && course.discountExpiresAt > now) {
      effectivePrice = Math.round(coursePrice * (1 - course.discountPercent / 100));
    }

    if (amount < effectivePrice - 0.01) {
      return {
        valid: false,
        expectedPrice: effectivePrice,
        itemName: course.title,
        error: `المبلغ المطلوب (${amount} جنيه) أقل من السعر المعتمد للكورس (${effectivePrice} جنيه).`,
      };
    }

    return { valid: true, expectedPrice: effectivePrice, itemName: course.title };
  }

  // 3. Folder Price Verification
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { name: true, price: true, isPurchasable: true },
    });

    if (!folder) {
      return { valid: false, expectedPrice: 0, itemName: "محاضرة", error: "المحاضرة المطلوبة غير موجودة" };
    }

    const folderPrice = folder.price ?? 0;
    if (amount < folderPrice - 0.01) {
      return {
        valid: false,
        expectedPrice: folderPrice,
        itemName: folder.name,
        error: `المبلغ المطلوب (${amount} جنيه) أقل من سعر المحاضرة المعتمد (${folderPrice} جنيه).`,
      };
    }

    return { valid: true, expectedPrice: folderPrice, itemName: folder.name };
  }

  // 4. Study Plan Price Verification
  if (planId) {
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
    const effectivePrice = hasActiveDiscount ? (plan.discountPrice ?? rawPlanPrice) : rawPlanPrice;

    if (amount < effectivePrice - 0.01) {
      return {
        valid: false,
        expectedPrice: effectivePrice,
        itemName: plan.title,
        error: `المبلغ المطلوب (${amount} جنيه) أقل من سعر الخطة المعتمد (${effectivePrice} جنيه).`,
      };
    }

    return { valid: true, expectedPrice: effectivePrice, itemName: plan.title };
  }

  // General wallet top-up (amount is checked against min/max limits)
  return { valid: true, expectedPrice: amount, itemName: "شحن رصيد المحفظة" };
}
