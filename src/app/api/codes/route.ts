import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ROLE_MESSAGES: Record<string, string> = {
  teacher: "حساب المعلم لا يمكنه تفعيل أكواد الكورسات — هذا الإجراء مخصص للمتعلمين فقط.",
  staff:   "حساب الموظف لا يمكنه تفعيل أكواد الكورسات — هذا الإجراء مخصص للمتعلمين فقط.",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً" }, { status: 401 });
    }

    // Teacher and staff are blocked — admins and superadmins are allowed through
    if (session.role === "teacher" || session.role === "staff") {
      return NextResponse.json(
        { error: ROLE_MESSAGES[session.role] },
        { status: 403 }
      );
    }

    const { code, teacherId, planType, grade, languageTrack, courseId, folderId, planId } = await req.json().catch(() => ({}));
    if (!code) return NextResponse.json({ error: "الكود مطلوب" }, { status: 400 });

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const { AccessCodeGuard } = await import("@/services/security/AccessCodeGuard");
    const { ReferralService } = await import("@/services/referral/ReferralService");

    // Enforce exponential rate limiting
    const rateCheck = await AccessCodeGuard.verifyRateLimit(clientIp, session.id);
    if (!rateCheck.allowed) {
      await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: String(code), success: false });
      return NextResponse.json(
        { error: `تم تجاوز عدد محاولات الكود المسموح بها. يرجى الانتظار ${rateCheck.lockTimeSeconds} ثانية قبل المحاولة مجدداً.` },
        { status: 429 }
      );
    }

    const normalizedCode = String(code).trim().toUpperCase();
    
    // Check Course Access Code
    const accessCode = await prisma.accessCode.findUnique({
      where: { code: normalizedCode },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            teacher: { select: { isDemo: true } },
          },
        },
      },
    });

    if (accessCode) {
      if (accessCode.course?.teacher?.isDemo && session.role !== "superadmin") {
        await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: normalizedCode, success: false });
        return NextResponse.json({ error: "محتوى تجريبي — الأكواد التجريبية مخصصة للمعاينة الإدارية فقط" }, { status: 403 });
      }

      if (accessCode.studentId) {
        await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: normalizedCode, success: false });
        return NextResponse.json({ error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
      }
      if (!accessCode.isActive) {
        await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: normalizedCode, success: false });
        return NextResponse.json({ error: "هذا الكود غير فعال" }, { status: 400 });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const alreadyEnrolled = await tx.accessCode.findFirst({
            where: { courseId: accessCode.courseId, studentId: session.id },
          });
          if (alreadyEnrolled) {
            return {
              alreadyEnrolled: true,
              courseId: accessCode.courseId,
              message: "أنت مسجل بالفعل في هذا الكورس",
            };
          }

          const updateResult = await tx.accessCode.updateMany({
            where: { id: accessCode.id, studentId: null, isActive: true },
            data: { studentId: session.id, usedAt: new Date() },
          });

          if (updateResult.count === 0) {
            throw new Error("ALREADY_USED_OR_INACTIVE");
          }

          const course = await tx.course.findUnique({
            where: { id: accessCode.courseId },
            select: { id: true, title: true },
          });

          return {
            alreadyEnrolled: false,
            courseId: accessCode.courseId,
            courseTitle: course?.title,
          };
        });

        if (result.alreadyEnrolled) {
          return NextResponse.json({
            success: true,
            courseId: result.courseId,
            message: result.message,
          });
        }

        // Log successful redemption
        await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: normalizedCode, success: true });

        return NextResponse.json({
          success: true,
          type: "course",
          courseId: result.courseId,
          courseTitle: result.courseTitle,
          message: "تم تفعيل الكود وإضافة الكورس إلى مكتبتك",
        });
      } catch (err: any) {
        await AccessCodeGuard.logAttempt({ ip: clientIp, userId: session.id, codeAttempted: normalizedCode, success: false });
        if (err.message === "ALREADY_USED_OR_INACTIVE") {
          return NextResponse.json({ error: "هذا الكود مستخدم بالفعل أو غير فعال" }, { status: 400 });
        }
        throw err;
      }
    }

    // Check Plan Access Code
    const planCode = await prisma.planAccessCode.findUnique({ where: { code: normalizedCode } });
    if (planCode) {
      if (planCode.usedById) {
        return NextResponse.json({ error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
      }
      if (!planCode.isActive) {
        return NextResponse.json({ error: "هذا الكود غير فعال" }, { status: 400 });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const student = await tx.user.findUnique({
            where: { id: session.id },
            select: { educationalStage: true }
          });

          const plan = await tx.plan.findUnique({ 
            where: { id: planCode.planId }, 
            select: { id: true, title: true, durationDays: true, educationalStage: true } 
          });

          if (!plan) throw new Error("PLAN_NOT_FOUND");

          if (student?.educationalStage && plan.educationalStage && student.educationalStage !== plan.educationalStage) {
            throw new Error("STAGE_MISMATCH");
          }

          const alreadyEnrolled = await tx.planEnrollment.findUnique({
            where: { planId_studentId: { planId: planCode.planId, studentId: session.id } },
          });

          const now = new Date();

          if (alreadyEnrolled) {
            const isExpired = alreadyEnrolled.expiresAt < now;
            if (isExpired) {
              const updateResult = await tx.planAccessCode.updateMany({
                where: { id: planCode.id, usedById: null, isActive: true },
                data: { usedById: session.id, usedAt: now, isActive: false },
              });
              if (updateResult.count === 0) {
                throw new Error("ALREADY_USED_OR_INACTIVE");
              }

              const durationDays = plan.durationDays ?? 365;
              await tx.planEnrollment.update({
                where: { id: alreadyEnrolled.id },
                data: {
                  unlockedAt: now,
                  expiresAt: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
                  pricePaid: 0,
                }
              });

              return {
                renewed: true,
                planId: planCode.planId,
                planTitle: plan.title,
              };
            }

            return {
              alreadyEnrolled: true,
              planId: planCode.planId,
            };
          }

          const updateResult = await tx.planAccessCode.updateMany({
            where: { id: planCode.id, usedById: null, isActive: true },
            data: { usedById: session.id, usedAt: now, isActive: false },
          });
          if (updateResult.count === 0) {
            throw new Error("ALREADY_USED_OR_INACTIVE");
          }

          const durationDays = plan.durationDays ?? 365;
          await tx.planEnrollment.create({
            data: {
              planId: planCode.planId,
              studentId: session.id,
              pricePaid: 0,
              expiresAt: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
            }
          });

          return {
            renewed: false,
            planId: planCode.planId,
            planTitle: plan.title,
          };
        });

        if (result.alreadyEnrolled) {
          return NextResponse.json({
            success: true,
            planId: result.planId,
            message: "أنت مسجل بالفعل في هذه الخطة",
          });
        }

        if (result.renewed) {
          return NextResponse.json({
            success: true,
            type: "plan",
            planId: result.planId,
            planTitle: result.planTitle,
            message: "تم تجديد اشتراكك في هذه الخطة بنجاح وتفعيل المحتوى",
          });
        }

        return NextResponse.json({
          success: true,
          type: "plan",
          planId: result.planId,
          planTitle: result.planTitle,
          message: "تم تفعيل الكود وإضافة الخطة إلى مكتبتك",
        });
      } catch (err: any) {
        if (err.message === "PLAN_NOT_FOUND") return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
        if (err.message === "STAGE_MISMATCH") return NextResponse.json({ error: "هذا الكود مخصص لمرحلة دراسية مختلفة" }, { status: 400 });
        if (err.message === "ALREADY_USED_OR_INACTIVE") return NextResponse.json({ error: "هذا الكود مستخدم بالفعل أو غير فعال" }, { status: 400 });
        throw err;
      }
    }

    // Check Money Code (Prepaid cash recharge card)
    const moneyCode = await prisma.moneyCode.findUnique({ where: { code: normalizedCode } });
    if (moneyCode) {
      if (moneyCode.isUsed) {
        return NextResponse.json({ error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
      }
      if (moneyCode.expiresAt && moneyCode.expiresAt < new Date()) {
        return NextResponse.json({ error: "هذا الكود منتهي الصلاحية" }, { status: 400 });
      }

      try {
        const creditedAmount = await prisma.$transaction(async (tx) => {
          const updateResult = await tx.moneyCode.updateMany({
            where: { id: moneyCode.id, isUsed: false },
            data: { isUsed: true, usedById: session.id, usedAt: new Date() },
          });

          if (updateResult.count === 0) {
            throw new Error("ALREADY_USED");
          }

          await tx.user.update({
            where: { id: session.id },
            data: { balance: { increment: moneyCode.amount } },
          });

          await tx.balanceTransaction.create({
            data: {
              userId: session.id,
              type: "credit_code",
              amount: moneyCode.amount,
              note: `كود: ${normalizedCode}`,
            },
          });

          return moneyCode.amount;
        });

        void ReferralService.qualifyAndRewardReferral(session.id, `code:${normalizedCode}`).catch(() => {});

        // Check if there is an item to purchase with the new balance
        const hasSpecificItem = Boolean(teacherId || courseId || folderId || planId);
        if (hasSpecificItem) {
          const { verifyAuthoritativePrice } = await import("@/lib/price-verifier");
          const priceCheck = await verifyAuthoritativePrice({
            amount: 999999,
            teacherId,
            planType,
            grade,
            languageTrack,
            courseId,
            folderId,
            planId,
          });

          if (priceCheck.valid && priceCheck.expectedPrice > 0) {
            const expectedPrice = priceCheck.expectedPrice;
            const updatedUser = await prisma.user.findUnique({
              where: { id: session.id },
              select: { balance: true },
            });
            const currentBalance = updatedUser?.balance ?? 0;

            if (currentBalance >= expectedPrice) {
              const origin = req.nextUrl ? req.nextUrl.origin : "https://code-up.tech";
              const reqHeaders = {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "",
              };

              let purchaseSuccess = false;
              let purchaseMessage = "";

              if (teacherId && planType) {
                const subRes = await fetch(`${origin}/api/teacher/subscribe-balance`, {
                  method: "POST",
                  headers: reqHeaders,
                  body: JSON.stringify({ teacherId, planType, languageTrack, studentGrade: grade }),
                });
                const subData = await subRes.json().catch(() => ({}));
                if (subRes.ok && !subData.error) {
                  purchaseSuccess = true;
                  purchaseMessage = subData.message || "تم تفعيل الاشتراك بالرصيد بنجاح!";
                }
              } else if (courseId) {
                const courseRes = await fetch(`${origin}/api/courses/${courseId}/purchase`, {
                  method: "POST",
                  headers: reqHeaders,
                  body: JSON.stringify({}),
                });
                const courseData = await courseRes.json().catch(() => ({}));
                if (courseRes.ok && !courseData.error) {
                  purchaseSuccess = true;
                  purchaseMessage = courseData.message || "تم شراء الكورس بنجاح!";
                }
              } else if (folderId) {
                const folderRes = await fetch(`${origin}/api/folders/${folderId}/purchase`, {
                  method: "POST",
                  headers: reqHeaders,
                  body: JSON.stringify({}),
                });
                const folderData = await folderRes.json().catch(() => ({}));
                if (folderRes.ok && !folderData.error) {
                  purchaseSuccess = true;
                  purchaseMessage = folderData.message || "تم شراء المحاضرة بنجاح!";
                }
              } else if (planId) {
                const planRes = await fetch(`${origin}/api/plans/${planId}/purchase`, {
                  method: "POST",
                  headers: reqHeaders,
                  body: JSON.stringify({}),
                });
                const planData = await planRes.json().catch(() => ({}));
                if (planRes.ok && !planData.error) {
                  purchaseSuccess = true;
                  purchaseMessage = planData.message || "تم تفعيل الخطة بنجاح!";
                }
              }

              if (purchaseSuccess) {
                const finalUser = await prisma.user.findUnique({
                  where: { id: session.id },
                  select: { balance: true },
                });
                const remaining = finalUser?.balance ?? 0;
                return NextResponse.json({
                  success: true,
                  type: "money_code_purchase",
                  credited: creditedAmount,
                  spent: expectedPrice,
                  remainingBalance: remaining,
                  message: `تم شحن الكود (${creditedAmount} ج) وتفعيل المحتوى بنجاح! المتبقي في رصيدك: ${remaining} جنيه 🎉`,
                });
              }
            } else {
              return NextResponse.json({
                success: true,
                type: "money_code_recharge",
                credited: creditedAmount,
                currentBalance,
                requiredPrice: expectedPrice,
                message: `تم إضافة قيمة الكود (${creditedAmount} ج) إلى رصيدك! رصيدك الحالي (${currentBalance} ج) ويلزمك ${expectedPrice - currentBalance} ج إضافية لإتمام الشراء.`,
              });
            }
          }
        }

        return NextResponse.json({
          success: true,
          type: "money_code",
          credited: creditedAmount,
          message: `تم شحن رصيدك بـ ${creditedAmount} جنيه بنجاح! 🎉`,
        });
      } catch (err: any) {
        if (err.message === "ALREADY_USED") {
          return NextResponse.json({ error: "هذا الكود مستخدم بالفعل" }, { status: 400 });
        }
        throw err;
      }
    }

    // Check Teacher Promo Code
    const teacher = await prisma.user.findFirst({
      where: {
        role: "teacher",
        promoProgramEnabled: true,
        promoCode: normalizedCode,
      },
      select: { id: true, name: true, promoCode: true, promoCodeCreatedAt: true },
    });

    if (teacher && teacher.promoCodeCreatedAt) {
      const now = new Date();
      const isWithin350Days = now.getTime() - teacher.promoCodeCreatedAt.getTime() <= 350 * 24 * 60 * 60 * 1000;

      if (!isWithin350Days) {
        return NextResponse.json({ error: "كود الخصم هذا منتهي الصلاحية" }, { status: 400 });
      }

      // Link student's referredByTeacherId
      await prisma.user.update({
        where: { id: session.id },
        data: { referredByTeacherId: teacher.id },
      });

      // Record initial signup/referral link attribution if not existing
      const existing = await prisma.teacherReferralAttribution.findFirst({
        where: { teacherId: teacher.id, studentId: session.id, purchaseType: "SIGNUP" },
      });

      if (!existing) {
        await prisma.teacherReferralAttribution.create({
          data: {
            teacherId: teacher.id,
            studentId: session.id,
            purchaseType: "SIGNUP",
            amount: 0,
            promoCodeUsed: teacher.promoCode,
          },
        });
      }

      return NextResponse.json({
        success: true,
        type: "teacher_promo",
        teacherName: teacher.name,
        message: `تم ربط حسابك بكود المعلم أ/ ${teacher.name} بنجاح!`,
      });
    }

    return NextResponse.json({ error: "الكود غير صحيح" }, { status: 404 });
  } catch (error) {
    console.error("[codes] error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
