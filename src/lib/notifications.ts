import { prisma } from "@/lib/prisma";

type NotificationType = "streak_milestone" | "exam_live" | "grade_resolved" | "referral_joined" | "project_graded";

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

/** Fire-and-forget — never throws, so callers don't need try/catch. */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    await prisma.notification.create({ data: payload });
  } catch {
    // Non-critical — if this fails the user just won't see the notification
  }
}

/** Award streak-milestone notification at 7, 14, 30, 60, 100 days. */
export async function notifyStreakMilestone(userId: string, streak: number): Promise<void> {
  const milestones: Record<number, string> = {
    7:   "أسبوع كامل! 🔥",
    14:  "أسبوعان متتاليان! 🔥🔥",
    30:  "شهر كامل من المواظبة! 💎",
    60:  "شهران متتاليان — أنت مميز! 💎💎",
    100: "١٠٠ يوم متتالي — إنجاز أسطوري! 🏆",
  };
  const label = milestones[streak];
  if (!label) return;
  await createNotification({
    userId,
    type: "streak_milestone",
    title: `سلسلتك وصلت ${streak} يوماً! ${label}`,
    body: "واصل تسجيل الدخول يومياً للحفاظ على سلسلتك وكسب المزيد من النقاط.",
    link: "/leaderboard",
  });
}

/** Notify all enrolled students when a daily exam goes live. */
export async function notifyExamLive(examId: string, stage: string, title: string): Promise<void> {
  try {
    const students = await prisma.user.findMany({
      where: { role: "student", educationalStage: stage, isDeleted: false },
      select: { id: true },
    });
    if (students.length === 0) return;
    await prisma.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        type: "exam_live",
        title: "تحدي يومي جديد متاح! 🎯",
        body: `امتحان "${title}" متاح الآن — اجتزه واحصل على نقاط إضافية!`,
        link: "/leaderboard",
      })),
    });
  } catch { /* non-critical */ }
}

/** Notify student when a grade adjustment request is resolved. */
export async function notifyGradeResolved(
  studentId: string,
  approved: boolean,
  quizTitle: string
): Promise<void> {
  await createNotification({
    userId: studentId,
    type: "grade_resolved",
    title: approved ? "تم قبول طلب تعديل الدرجة ✅" : "طلب تعديل الدرجة مرفوض",
    body: approved
      ? `تم قبول طلب تعديل درجتك في "${quizTitle}". تحقق من نتائجك.`
      : `رفض المعلم طلب تعديل درجتك في "${quizTitle}".`,
    link: "/library",
  });
}

/** Notify student when a project has been graded. */
export async function notifyProjectGraded(
  studentId: string,
  lessonTitle: string,
  grade: number
): Promise<void> {
  await createNotification({
    userId: studentId,
    type: "project_graded",
    title: `تم تقييم مشروعك في درس ${lessonTitle} 🎉`,
    body: `حصلت على درجة ${grade}% في مشروعك الأخير. تحقق من التقييم الآن.`,
    link: "/library",
  });
}
