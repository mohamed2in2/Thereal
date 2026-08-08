import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resetDemoTeacherIdCache } from "../src/lib/demo";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });

async function main() {
  console.log("🧹 Starting Demo Teacher Teardown...");

  const demoTeacher = await prisma.user.findFirst({
    where: { isDemo: true, role: "teacher" },
    select: { id: true },
  });

  if (!demoTeacher) {
    console.log("ℹ️ No demo teacher found in database.");
    return;
  }

  const teacherId = demoTeacher.id;

  const demoStudents = await prisma.user.findMany({
    where: { isDemo: true, role: "student" },
    select: { id: true },
  });
  const studentIds = demoStudents.map((s) => s.id);

  const demoCourses = await prisma.course.findMany({
    where: { teacherId },
    select: { id: true },
  });
  const courseIds = demoCourses.map((c) => c.id);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete parent tokens & verification events
    const parentTokensDeleted = await tx.parentToken.deleteMany({ where: { studentId: { in: studentIds } } });
    const parentEventsDeleted = await tx.parentVerificationEvent.deleteMany({ where: { studentId: { in: studentIds } } });

    // 2. Delete submissions & reviews
    const submissionsDeleted = await tx.homeworkSubmission.deleteMany({ where: { studentId: { in: studentIds } } });
    const homeworksDeleted = await tx.homework.deleteMany({ where: { teacherId } });

    // 3. Delete quiz results & answers
    const quizResultsDeleted = await tx.quizResult.deleteMany({ where: { studentId: { in: studentIds } } });

    // 4. Delete access codes & purchases
    const accessCodesDeleted = await tx.accessCode.deleteMany({ where: { courseId: { in: courseIds } } });
    const folderPurchasesDeleted = await tx.folderPurchase.deleteMany({ where: { studentId: { in: studentIds } } });
    const videoPurchasesDeleted = await tx.videoPurchase.deleteMany({ where: { studentId: { in: studentIds } } });

    // 5. Delete teacher subscriptions
    const teacherSubsDeleted = await tx.teacherSubscription.deleteMany({ where: { teacherId } });

    // 6. Delete courses & teacher profile
    const coursesDeleted = await tx.course.deleteMany({ where: { teacherId } });
    const profileDeleted = await tx.teacherProfile.deleteMany({ where: { teacherId } });

    // 7. Delete demo users (teacher + demo students)
    const usersDeleted = await tx.user.deleteMany({ where: { isDemo: true } });

    return {
      parentTokens: parentTokensDeleted.count,
      parentEvents: parentEventsDeleted.count,
      submissions: submissionsDeleted.count,
      homeworks: homeworksDeleted.count,
      quizResults: quizResultsDeleted.count,
      accessCodes: accessCodesDeleted.count,
      folderPurchases: folderPurchasesDeleted.count,
      videoPurchases: videoPurchasesDeleted.count,
      teacherSubs: teacherSubsDeleted.count,
      courses: coursesDeleted.count,
      profile: profileDeleted.count,
      users: usersDeleted.count,
    };
  });

  resetDemoTeacherIdCache();

  console.log("✅ Teardown Complete! Summary of deleted records:");
  console.table(result);
}

main()
  .catch((e) => {
    console.error("❌ Teardown failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
