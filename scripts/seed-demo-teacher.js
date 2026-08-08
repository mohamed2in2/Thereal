/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

const client = createClient({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });

async function main() {
  console.log("🌱 Starting Demo Teacher Seeding via @libsql/client...");

  // 1. Safety Check: Verify no non-demo teacher named "test" exists
  const existingNonDemo = await client.execute({
    sql: "SELECT id FROM User WHERE name = ? AND role = 'teacher' AND isDemo = 0",
    args: ["test"],
  });

  if (existingNonDemo.rows.length > 0) {
    console.error("❌ ERROR: A real non-demo teacher account named 'test' already exists! Aborting.");
    process.exit(1);
  }

  const rawPassword = process.env.DEMO_TEACHER_PASSWORD || "Admin123";
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const now = new Date().toISOString();

  // 2. Upsert Demo Teacher User (User.name MUST be "test" for login)
  const teacherId = "demo-teacher-id-1001";
  await client.execute({
    sql: `INSERT INTO User (id, name, email, phone, password, role, isDemo, isActive, isDeleted, codeIssuanceLimit, createdAt, updatedAt)
          VALUES (?, 'test', 'demo_teacher@test.local', '01000000099', ?, 'teacher', 1, 1, 0, 0, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name='test', password=excluded.password, role='teacher', isDemo=1, isActive=1, isDeleted=0, codeIssuanceLimit=0`,
    args: [teacherId, passwordHash, now, now],
  });

  console.log(`✅ Demo Teacher User ID: ${teacherId}`);

  // 3. Upsert Teacher Profile
  await client.execute({
    sql: `INSERT INTO TeacherProfile (id, teacherId, displayName, slug, bio, subject, educationalStage, isPublished, priceMonthly, priceTermly, priceYearly, accentColor, navColor, createdAt, updatedAt)
          VALUES ('demo-profile-id', ?, 'المدرس التجريبي (DEMO)', 'demo', 'صفحة أستاذ الشرح التجريبي لعرض واستعراض كافة مزايا وإمكانيات المنصة للإدارة والمشرفين فقط.', 'برمجة وحاسب آلي', 'sec_1', 1, 200, 500, 1200, '#f59e0b', '#1e1b4b', ?, ?)
          ON CONFLICT(teacherId) DO UPDATE SET
            displayName='المدرس التجريبي (DEMO)', slug='demo', isPublished=1`,
    args: [teacherId, now, now],
  });

  console.log(`✅ Demo Teacher Profile: demo`);

  // 4. Seed Courses
  const courseFreeId = "demo-course-free";
  const coursePaidId = "demo-course-paid";
  const courseDiscountId = "demo-course-discount";

  const discountExpiry = new Date();
  discountExpiry.setDate(discountExpiry.getDate() + 30);

  await client.execute({
    sql: `INSERT INTO Course (id, title, subject, educationalStage, description, isPaid, price, teacherId, createdAt, updatedAt)
          VALUES (?, 'المقدمة المجانية في البرمجة والتفكير المنطقي (DEMO)', 'برمجة وحاسب آلي', 'sec_1', 'كورس مجاني بالكامل يستعرض أساسيات التفكير المنطقي ولغات البرمجة.', 0, 0, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [courseFreeId, teacherId, now, now],
  });

  await client.execute({
    sql: `INSERT INTO Course (id, title, subject, educationalStage, description, isPaid, price, teacherId, createdAt, updatedAt)
          VALUES (?, 'أساسيات خوارزميات وهياكل البيانات - الترم الأول (DEMO)', 'برمجة وحاسب آلي', 'sec_1', 'كورس مدفوع شاملاً بالشروح والواجبات والاختبارات التفاعلية.', 1, 250, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [coursePaidId, teacherId, now, now],
  });

  await client.execute({
    sql: `INSERT INTO Course (id, title, subject, educationalStage, description, isPaid, price, discountPercent, discountExpiresAt, teacherId, createdAt, updatedAt)
          VALUES (?, 'تطوير تطبيقات الويب المتكاملة - المستوى المتقدم (DEMO)', 'برمجة وحاسب آلي', 'sec_2', 'كورس مدفوع خصم خاص للفترة المحدودة.', 1, 400, 25, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [courseDiscountId, discountExpiry.toISOString(), teacherId, now, now],
  });

  // 5. Folders
  const folderFreeId = "demo-folder-free";
  const folderPurchasableId = "demo-folder-purchasable";

  await client.execute({
    sql: `INSERT INTO Folder (id, name, courseId, "order", price, isPurchasable, createdAt)
          VALUES (?, 'المحاضرة الأولى: مقدمة البيئة البرمجية (مجانية)', ?, 1, 0, 1, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
    args: [folderFreeId, coursePaidId, now],
  });

  await client.execute({
    sql: `INSERT INTO Folder (id, name, courseId, "order", price, isPurchasable, createdAt)
          VALUES (?, 'المحاضرة الثانية: التعمق في مصفوفات القوائم (تباع منفردة)', ?, 2, 80, 1, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
    args: [folderPurchasableId, coursePaidId, now],
  });

  // 6. Videos
  await client.execute({
    sql: `INSERT INTO Video (id, title, folderId, videoProvider, providerVideoId, durationMinutes, isFree, "order")
          VALUES ('demo-video-free', 'درس 1: كود الشرح المجاني والتنفيذ الحي', ?, 'youtube', 'dQw4w9WgXcQ', 25, 1, 1)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [folderFreeId],
  });

  await client.execute({
    sql: `INSERT INTO Video (id, title, folderId, videoProvider, providerVideoId, durationMinutes, isFree, "order")
          VALUES ('demo-video-paid', 'درس 2: تحليل التعقيد الزمني والمكاني Big-O', ?, 'youtube', 'dQw4w9WgXcQ', 45, 0, 2)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [folderFreeId],
  });

  await client.execute({
    sql: `INSERT INTO Video (id, title, folderId, videoProvider, providerVideoId, durationMinutes, isFree, "order")
          VALUES ('demo-video-native', 'درس 3: رفع المحتوى المباشر بالسيرفر المحترس (Direct Upload)', ?, 'native', 'local_demo_sample.mp4', 30, 0, 1)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [folderPurchasableId],
  });

  // 7. Homework & Quiz
  await client.execute({
    sql: `INSERT INTO Homework (id, title, type, teacherId, courseId, folderId, createdAt)
          VALUES ('demo-homework-1', 'واجب الخوارزميات التطبيقي الأول', 'ESSAY', ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [teacherId, coursePaidId, folderFreeId, now],
  });

  await client.execute({
    sql: `INSERT INTO Quiz (id, title, folderId, timeLimitMinutes, createdAt)
          VALUES ('demo-quiz-1', 'اختبار قياس المفاهيم الأساسية', ?, 15, ?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
    args: [folderFreeId, now],
  });

  // 8. Fake Students (1 to 6)
  const studentIds = [];
  for (let i = 1; i <= 6; i++) {
    const sId = `demo-student-id-${i}`;
    studentIds.push(sId);
    await client.execute({
      sql: `INSERT INTO User (id, name, email, phone, parentPhone, role, isDemo, educationalStage, points, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'student', 1, 'sec_1', ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET name=excluded.name, isDemo=1`,
      args: [sId, `طالب تجريبي ${i}`, `demo_student_${i}@test.local`, `0109999000${i}`, `0108888000${i}`, 50 * i, now, now],
    });
  }

  console.log(`✅ Seeded 6 Demo Student Accounts.`);

  // 9. Access Codes & Purchases
  await client.execute({
    sql: `INSERT INTO AccessCode (id, code, courseId, accessType, studentId, isActive, usedAt, createdAt)
          VALUES ('demo-code-1', 'DEMO-COURSE-101', ?, 'TERM', ?, 1, ?, ?)
          ON CONFLICT(code) DO UPDATE SET isActive=1`,
    args: [coursePaidId, studentIds[0], now, now],
  });

  await client.execute({
    sql: `INSERT INTO AccessCode (id, code, courseId, folderId, accessType, studentId, isActive, createdAt)
          VALUES ('demo-code-2', 'DEMO-FOLDER-202', ?, ?, 'FOLDER', NULL, 1, ?)
          ON CONFLICT(code) DO UPDATE SET isActive=1`,
    args: [coursePaidId, folderPurchasableId, now],
  });

  await client.execute({
    sql: `INSERT INTO FolderPurchase (id, studentId, folderId, price, createdAt)
          VALUES ('demo-fp-1', ?, ?, 80, ?)
          ON CONFLICT(studentId, folderId) DO UPDATE SET price=80`,
    args: [studentIds[1], folderPurchasableId, now],
  });

  await client.execute({
    sql: `INSERT INTO VideoPurchase (id, studentId, videoId, price, createdAt)
          VALUES ('demo-vp-1', ?, 'demo-video-paid', 50, ?)
          ON CONFLICT(studentId, videoId) DO UPDATE SET price=50`,
    args: [studentIds[2], now],
  });

  // 10. Teacher Subscriptions
  await client.execute({ sql: "DELETE FROM TeacherSubscription WHERE teacherId = ?", args: [teacherId] });
  await client.execute({
    sql: `INSERT INTO TeacherSubscription (id, teacherId, studentId, subscriptionType, status, amountPaid, createdAt, updatedAt)
          VALUES ('demo-sub-1', ?, ?, 'MONTHLY', 'APPROVED', 200, ?, ?)`,
    args: [teacherId, studentIds[0], now, now],
  });
  await client.execute({
    sql: `INSERT INTO TeacherSubscription (id, teacherId, studentId, subscriptionType, status, amountPaid, createdAt, updatedAt)
          VALUES ('demo-sub-2', ?, ?, 'TERMLY', 'APPROVED', 500, ?, ?)`,
    args: [teacherId, studentIds[1], now, now],
  });
  await client.execute({
    sql: `INSERT INTO TeacherSubscription (id, teacherId, studentId, subscriptionType, status, amountPaid, createdAt, updatedAt)
          VALUES ('demo-sub-3', ?, ?, 'YEARLY', 'PENDING_VERIFICATION', 1200, ?, ?)`,
    args: [teacherId, studentIds[2], now, now],
  });

  // 11. Parent Token
  await client.execute({
    sql: `INSERT INTO ParentToken (id, studentId, token, createdAt)
          VALUES ('demo-pt-1', ?, 'demo-parent-token-12345', ?)
          ON CONFLICT(studentId) DO UPDATE SET token='demo-parent-token-12345'`,
    args: [studentIds[0], now],
  });

  console.log("✨ Demo Teacher Seeding Successfully Completed!");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
