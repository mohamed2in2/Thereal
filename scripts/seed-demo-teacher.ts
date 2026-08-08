import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });

async function main() {
  console.log("🌱 Starting Demo Teacher Seeding...");

  // 1. Safety Check: Verify no non-demo teacher named "test" exists
  const existingNonDemo = await prisma.user.findFirst({
    where: { name: "test", role: "teacher", isDemo: false },
  });

  if (existingNonDemo) {
    console.error("❌ ERROR: A real non-demo teacher account named 'test' already exists! Aborting.");
    process.exit(1);
  }

  const rawPassword = process.env.DEMO_TEACHER_PASSWORD ?? "Admin123";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 2. Upsert Demo Teacher User (User.name MUST be "test" for login)
  const teacherUser = await prisma.user.upsert({
    where: { email: "demo_teacher@test.local" },
    update: {
      name: "test",
      password: passwordHash,
      role: "teacher",
      isDemo: true,
      isActive: true,
      isDeleted: false,
    },
    create: {
      name: "test",
      email: "demo_teacher@test.local",
      phone: "01000000099",
      password: passwordHash,
      role: "teacher",
      isDemo: true,
      isActive: true,
      isDeleted: false,
    },
  });

  console.log(`✅ Demo Teacher User ID: ${teacherUser.id}`);

  // 3. Upsert Teacher Profile
  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { teacherId: teacherUser.id },
    update: {
      displayName: "المدرس التجريبي (DEMO)",
      slug: "demo",
      bio: "صفحة أستاذ الشرح التجريبي لعرض واستعراض كافة مزايا وإمكانيات المنصة للإدارة والمشرفين فقط.",
      isPublished: true,
      priceMonthly: 200,
      priceTermly: 500,
      priceYearly: 1200,
      accentColor: "#f59e0b",
      navColor: "#1e1b4b",
    },
    create: {
      teacherId: teacherUser.id,
      displayName: "المدرس التجريبي (DEMO)",
      slug: "demo",
      bio: "صفحة أستاذ الشرح التجريبي لعرض واستعراض كافة مزايا وإمكانيات المنصة للإدارة والمشرفين فقط.",
      isPublished: true,
      priceMonthly: 200,
      priceTermly: 500,
      priceYearly: 1200,
      accentColor: "#f59e0b",
      navColor: "#1e1b4b",
    },
  });

  console.log(`✅ Demo Teacher Profile: ${teacherProfile.slug}`);

  // 4. Seed Courses
  // Course A: Free Course
  const courseFree = await prisma.course.upsert({
    where: { id: "demo-course-free" },
    update: {
      title: "المقدمة المجانية في البرمجة والتفكير المنطقي (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_1",
      description: "كورس مجاني بالكامل يستعرض أساسيات التفكير المنطقي ولغات البرمجة.",
      isPaid: false,
      price: 0,
      teacherId: teacherUser.id,
    },
    create: {
      id: "demo-course-free",
      title: "المقدمة المجانية في البرمجة والتفكير المنطقي (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_1",
      description: "كورس مجاني بالكامل يستعرض أساسيات التفكير المنطقي ولغات البرمجة.",
      isPaid: false,
      price: 0,
      teacherId: teacherUser.id,
    },
  });

  // Course B: Paid Course
  const coursePaid = await prisma.course.upsert({
    where: { id: "demo-course-paid" },
    update: {
      title: "أساسيات خوارزميات وهياكل البيانات - الترم الأول (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_1",
      description: "كورس مدفوع شاملاً بالشروح والواجبات والاختبارات التفاعلية.",
      isPaid: true,
      price: 250,
      teacherId: teacherUser.id,
    },
    create: {
      id: "demo-course-paid",
      title: "أساسيات خوارزميات وهياكل البيانات - الترم الأول (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_1",
      description: "كورس مدفوع شاملاً بالشروح والواجبات والاختبارات التفاعلية.",
      isPaid: true,
      price: 250,
      teacherId: teacherUser.id,
    },
  });

  // Course C: Paid Course with Active Discount
  const discountExpiry = new Date();
  discountExpiry.setDate(discountExpiry.getDate() + 30);
  const courseDiscount = await prisma.course.upsert({
    where: { id: "demo-course-discount" },
    update: {
      title: "تطوير تطبيقات الويب المتكاملة - المستوى المتقدم (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_2",
      description: "كورس مدفوع خصم خاص للفترة المحدودة.",
      isPaid: true,
      price: 400,
      discountPercent: 25,
      discountExpiresAt: discountExpiry,
      teacherId: teacherUser.id,
    },
    create: {
      id: "demo-course-discount",
      title: "تطوير تطبيقات الويب المتكاملة - المستوى المتقدم (DEMO)",
      subject: "برمجة وحاسب آلي",
      educationalStage: "sec_2",
      description: "كورس مدفوع خصم خاص للفترة المحدودة.",
      isPaid: true,
      price: 400,
      discountPercent: 25,
      discountExpiresAt: discountExpiry,
      teacherId: teacherUser.id,
    },
  });

  // 5. Seed Folders & Content in Paid Course
  const folderFree = await prisma.folder.upsert({
    where: { id: "demo-folder-free" },
    update: {
      name: "المحاضرة الأولى: مقدمة البيئة البرمجية (مجانية)",
      courseId: coursePaid.id,
      order: 1,
      price: 0,
      isPurchasable: true,
    },
    create: {
      id: "demo-folder-free",
      name: "المحاضرة الأولى: مقدمة البيئة البرمجية (مجانية)",
      courseId: coursePaid.id,
      order: 1,
      price: 0,
      isPurchasable: true,
    },
  });

  const folderPurchasable = await prisma.folder.upsert({
    where: { id: "demo-folder-purchasable" },
    update: {
      name: "المحاضرة الثانية: التعمق في مصفوفات القوائم (تباع منفردة)",
      courseId: coursePaid.id,
      order: 2,
      price: 80,
      isPurchasable: true,
    },
    create: {
      id: "demo-folder-purchasable",
      name: "المحاضرة الثانية: التعمق في مصفوفات القوائم (تباع منفردة)",
      courseId: coursePaid.id,
      order: 2,
      price: 80,
      isPurchasable: true,
    },
  });

  // Videos
  const videoFree = await prisma.video.upsert({
    where: { id: "demo-video-free" },
    update: {
      title: "درس 1: كود الشرح المجاني والتنفيذ الحي",
      folderId: folderFree.id,
      videoProvider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
      durationMinutes: 25,
      isFree: true,
      order: 1,
    },
    create: {
      id: "demo-video-free",
      title: "درس 1: كود الشرح المجاني والتنفيذ الحي",
      folderId: folderFree.id,
      videoProvider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
      durationMinutes: 25,
      isFree: true,
      order: 1,
    },
  });

  const videoPaid = await prisma.video.upsert({
    where: { id: "demo-video-paid" },
    update: {
      title: "درس 2: تحليل التعقيد الزمني والمكاني Big-O",
      folderId: folderFree.id,
      videoProvider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
      durationMinutes: 45,
      isFree: false,
      order: 2,
    },
    create: {
      id: "demo-video-paid",
      title: "درس 2: تحليل التعقيد الزمني والمكاني Big-O",
      folderId: folderFree.id,
      videoProvider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
      durationMinutes: 45,
      isFree: false,
      order: 2,
    },
  });

  const videoNative = await prisma.video.upsert({
    where: { id: "demo-video-native" },
    update: {
      title: "درس 3: رفع المحتوى المباشر بالسيرفر المحترس (Direct Upload)",
      folderId: folderPurchasable.id,
      videoProvider: "native",
      providerVideoId: "local_demo_sample.mp4",
      durationMinutes: 30,
      isFree: false,
      order: 1,
    },
    create: {
      id: "demo-video-native",
      title: "درس 3: رفع المحتوى المباشر بالسيرفر المحترس (Direct Upload)",
      folderId: folderPurchasable.id,
      videoProvider: "native",
      providerVideoId: "local_demo_sample.mp4",
      durationMinutes: 30,
      isFree: false,
      order: 1,
    },
  });

  // Homework
  const homework = await prisma.homework.upsert({
    where: { id: "demo-homework-1" },
    update: {
      title: "واجب الخوارزميات التطبيقي الأول",
      type: "ESSAY",
      teacherId: teacherUser.id,
      courseId: coursePaid.id,
      folderId: folderFree.id,
    },
    create: {
      id: "demo-homework-1",
      title: "واجب الخوارزميات التطبيقي الأول",
      type: "ESSAY",
      teacherId: teacherUser.id,
      courseId: coursePaid.id,
      folderId: folderFree.id,
    },
  });

  // Quizzes
  const quiz = await prisma.quiz.upsert({
    where: { id: "demo-quiz-1" },
    update: {
      title: "اختبار قياس المفاهيم الأساسية",
      folderId: folderFree.id,
      timeLimitMinutes: 15,
    },
    create: {
      id: "demo-quiz-1",
      title: "اختبار قياس المفاهيم الأساسية",
      folderId: folderFree.id,
      timeLimitMinutes: 15,
    },
  });

  // Quiz Questions
  await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
  await prisma.quizQuestion.createMany({
    data: [
      {
        quizId: quiz.id,
        question: "ما هو التعقيد الزمني الخطي لترتيب المصفوفة الفردية؟",
        optionA: "O(1)",
        optionB: "O(N)",
        optionC: "O(N^2)",
        optionD: "O(log N)",
        correctAnswer: "optionB",
        order: 1,
      },
      {
        quizId: quiz.id,
        question: "أي من الهياكل التالية يعتمد مبدأ LIFO؟",
        optionA: "Queue",
        optionB: "Stack",
        optionC: "Array",
        optionD: "Tree",
        correctAnswer: "optionB",
        order: 2,
      },
    ],
  });

  // 6. Seed Fake Students (6 students named "طالب تجريبي ١" to "٦")
  const studentUsers = [];
  for (let i = 1; i <= 6; i++) {
    const student = await prisma.user.upsert({
      where: { email: `demo_student_${i}@test.local` },
      update: {
        name: `طالب تجريبي ${i}`,
        phone: `0109999000${i}`,
        parentPhone: `0108888000${i}`,
        role: "student",
        isDemo: true,
        educationalStage: "sec_1",
        points: 50 * i,
      },
      create: {
        email: `demo_student_${i}@test.local`,
        name: `طالب تجريبي ${i}`,
        phone: `0109999000${i}`,
        parentPhone: `0108888000${i}`,
        role: "student",
        isDemo: true,
        educationalStage: "sec_1",
        points: 50 * i,
      },
    });
    studentUsers.push(student);
  }

  console.log(`✅ Seeded ${studentUsers.length} Demo Student Accounts.`);

  // 7. Seed Access Codes, Purchases, & Subscriptions
  // Course Access Code (Redeemed by Student 1)
  await prisma.accessCode.upsert({
    where: { code: "DEMO-COURSE-101" },
    update: {
      courseId: coursePaid.id,
      accessType: "TERM",
      studentId: studentUsers[0].id,
      isActive: true,
      usedAt: new Date(),
    },
    create: {
      code: "DEMO-COURSE-101",
      courseId: coursePaid.id,
      accessType: "TERM",
      studentId: studentUsers[0].id,
      isActive: true,
      usedAt: new Date(),
    },
  });

  // Unused Folder Access Code
  await prisma.accessCode.upsert({
    where: { code: "DEMO-FOLDER-202" },
    update: {
      courseId: coursePaid.id,
      folderId: folderPurchasable.id,
      accessType: "FOLDER",
      studentId: null,
      isActive: true,
    },
    create: {
      code: "DEMO-FOLDER-202",
      courseId: coursePaid.id,
      folderId: folderPurchasable.id,
      accessType: "FOLDER",
      studentId: null,
      isActive: true,
    },
  });

  // FolderPurchase for Student 2
  await prisma.folderPurchase.upsert({
    where: { studentId_folderId: { studentId: studentUsers[1].id, folderId: folderPurchasable.id } },
    update: { price: 80 },
    create: { studentId: studentUsers[1].id, folderId: folderPurchasable.id, price: 80 },
  });

  // VideoPurchase for Student 3
  await prisma.videoPurchase.upsert({
    where: { studentId_videoId: { studentId: studentUsers[2].id, videoId: videoPaid.id } },
    update: { price: 50 },
    create: { studentId: studentUsers[2].id, videoId: videoPaid.id, price: 50 },
  });

  // Teacher Subscriptions
  await prisma.teacherSubscription.deleteMany({ where: { teacherId: teacherUser.id } });
  await prisma.teacherSubscription.createMany({
    data: [
      {
        teacherId: teacherUser.id,
        studentId: studentUsers[0].id,
        planType: "monthly",
        planLabel: "اشتراك شهري",
        status: "active",
        amount: 200,
        educationalStage: "sec_1",
      },
      {
        teacherId: teacherUser.id,
        studentId: studentUsers[1].id,
        planType: "termly",
        planLabel: "اشتراك ترمي",
        status: "active",
        amount: 500,
        educationalStage: "sec_1",
      },
      {
        teacherId: teacherUser.id,
        studentId: studentUsers[2].id,
        planType: "yearly",
        planLabel: "اشتراك سنوي",
        status: "active",
        amount: 1200,
        educationalStage: "sec_1",
      },
    ],
  });

  // 8. Homework Submissions & Quiz Results
  await prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId: homework.id, studentId: studentUsers[0].id } },
    update: { submittedOutput: "إجابة الطالب التجريبي الأول النموذجية على السؤال الأول والثاني.", status: "passed", score: 95, totalQ: 2 },
    create: { homeworkId: homework.id, studentId: studentUsers[0].id, submittedOutput: "إجابة الطالب التجريبي الأول النموذجية على السؤال الأول والثاني.", status: "passed", score: 95, totalQ: 2 },
  });

  await prisma.quizResult.upsert({
    where: { studentId_quizId: { studentId: studentUsers[0].id, quizId: quiz.id } },
    update: { score: 100, totalQ: 2 },
    create: { quizId: quiz.id, studentId: studentUsers[0].id, score: 100, totalQ: 2 },
  });

  // 9. Parent Token for Student 1
  await prisma.parentToken.upsert({
    where: { studentId: studentUsers[0].id },
    update: { token: "demo-parent-token-12345" },
    create: { studentId: studentUsers[0].id, token: "demo-parent-token-12345" },
  });

  console.log("✨ Demo Teacher Seeding Successfully Completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
