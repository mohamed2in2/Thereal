import { prisma } from "@/lib/prisma";

export interface ProcessAttributionInput {
  studentId: string;
  teacherIdOfContent: string;
  amount: number;
  purchaseType: "COURSE" | "FOLDER" | "VIDEO";
  courseId?: string;
  folderId?: string;
  videoId?: string;
  promoCodeInput?: string | null;
  tx?: any;
}

/**
 * Attributes purchase revenue to a teacher per platform rules:
 * - Case A: Promo code entered at purchase time matching content teacher's active code (<350d).
 * - Case B: Student previously referred by content teacher on signup (only attributes for content teacher's own content).
 */
export async function processTeacherAttribution(input: ProcessAttributionInput) {
  const db = input.tx || prisma;
  const {
    studentId,
    teacherIdOfContent,
    amount,
    purchaseType,
    courseId,
    folderId,
    videoId,
    promoCodeInput,
  } = input;

  if (amount <= 0 || !teacherIdOfContent) return;

  const now = new Date();
  const PROMO_EXPIRY_MS = 350 * 24 * 60 * 60 * 1000;

  // Case A: Explicit promo code entered at purchase time
  if (promoCodeInput) {
    const codeUpper = String(promoCodeInput).trim().toUpperCase();
    const promoTeacher = await db.user.findFirst({
      where: {
        role: "teacher",
        promoProgramEnabled: true,
        promoCode: codeUpper,
      },
      select: { id: true, promoCodeCreatedAt: true },
    });

    if (promoTeacher && promoTeacher.id === teacherIdOfContent && promoTeacher.promoCodeCreatedAt) {
      if (now.getTime() - new Date(promoTeacher.promoCodeCreatedAt).getTime() <= PROMO_EXPIRY_MS) {
        await db.teacherReferralAttribution.create({
          data: {
            teacherId: promoTeacher.id,
            studentId,
            purchaseType,
            courseId,
            folderId,
            videoId,
            amount,
            promoCodeUsed: codeUpper,
          },
        });
        return;
      }
    }
  }

  // Case B: Account-level referral from signup
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { referredByTeacherId: true },
  });

  if (student?.referredByTeacherId && student.referredByTeacherId === teacherIdOfContent) {
    const referringTeacher = await db.user.findUnique({
      where: { id: student.referredByTeacherId },
      select: { id: true, promoProgramEnabled: true },
    });

    if (referringTeacher?.promoProgramEnabled) {
      await db.teacherReferralAttribution.create({
        data: {
          teacherId: referringTeacher.id,
          studentId,
          purchaseType,
          courseId,
          folderId,
          videoId,
          amount,
        },
      });
    }
  }
}
