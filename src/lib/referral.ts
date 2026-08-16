import { prisma } from "@/lib/prisma";

export interface ProcessAttributionInput {
  studentId: string;
  teacherIdOfContent: string;
  amount: number;
  purchaseType: "COURSE" | "FOLDER" | "VIDEO" | "PLAN" | "TEACHER_SUB";
  courseId?: string;
  folderId?: string;
  videoId?: string;
  promoCodeInput?: string | null;
  tx?: any;
}

/**
 * Attributes purchase revenue to a teacher per platform rules:
 * - ONLY when a student entered the teacher's code when creating an account (`referredByTeacherId`).
 * - AND when the student comes to buy content from that EXACT SAME teacher (`student.referredByTeacherId === teacherIdOfContent`).
 * - If the student buys from a different teacher, or did not enter a teacher code at signup, NO affiliate attribution is created or shown.
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
  } = input;

  if (amount <= 0 || !teacherIdOfContent || !studentId) return;

  // Retrieve student's referredByTeacherId assigned at account creation
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { referredByTeacherId: true },
  });

  // Strict Rule: ONLY attribute if the student registered with THIS exact teacher's code
  if (student?.referredByTeacherId && student.referredByTeacherId === teacherIdOfContent) {
    const referringTeacher = await db.user.findUnique({
      where: { id: student.referredByTeacherId },
      select: { id: true, promoProgramEnabled: true, promoCode: true, isDeleted: true },
    });

    if (referringTeacher && referringTeacher.promoProgramEnabled && !referringTeacher.isDeleted) {
      await db.teacherReferralAttribution.create({
        data: {
          teacherId: referringTeacher.id,
          studentId,
          purchaseType,
          courseId,
          folderId,
          videoId,
          amount,
          promoCodeUsed: referringTeacher.promoCode || undefined,
        },
      });
    }
  }
}

