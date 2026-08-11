import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { isTester, canBypassPayment, canWatchUnlimited, logTesterActivity } from "../src/lib/tester";
import { TeacherVisibilityService } from "../src/services/teacher/TeacherVisibilityService";
import { PurchaseService } from "../src/services/purchase/PurchaseService";
import bcrypt from "bcryptjs";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 STARTING QA TESTER SYSTEM & TEACHER INVISIBILITY TEST SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  try {
    // ── Setup Fixtures ───────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash("password123", 10);

    // 1. Create a Teacher
    const teacher = await prisma.user.create({
      data: {
        name: `Teacher_${timestamp}`,
        email: `teacher_${timestamp}@test.edu`,
        phone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "teacher",
        password: hashedPassword,
        isActive: true,
      },
    });

    // 2. Create a Course owned by the Teacher (Price: 500 EGP)
    const course = await prisma.course.create({
      data: {
        title: `Biology Grade 10 - ${timestamp}`,
        subject: "Biology",
        teacherId: teacher.id,
        isPaid: true,
        price: 500,
        educationalStage: "sec_1",
      },
    });

    // 3. Create a Folder and a Video
    const folder = await prisma.folder.create({
      data: {
        name: `Chapter 1 - Cells`,
        courseId: course.id,
      },
    });

    const video = await prisma.video.create({
      data: {
        title: `Cell Membrane Video`,
        folderId: folder.id,
        vdoCipherId: `123456`,
        maxWatchesPerUser: 3,
        isFree: false,
      },
    });

    // 4. Create 3 Real Students
    const student1 = await prisma.user.create({
      data: {
        name: `Real Student 1`,
        email: `student1_${timestamp}@test.edu`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "student",
        accountMode: "NORMAL",
        password: hashedPassword,
        balance: 1000,
        isActive: true,
      },
    });

    const student2 = await prisma.user.create({
      data: {
        name: `Real Student 2`,
        email: `student2_${timestamp}@test.edu`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "student",
        accountMode: "NORMAL",
        password: hashedPassword,
        balance: 1000,
        isActive: true,
      },
    });

    const student3 = await prisma.user.create({
      data: {
        name: `Real Student 3`,
        email: `student3_${timestamp}@test.edu`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "student",
        accountMode: "NORMAL",
        password: hashedPassword,
        balance: 1000,
        isActive: true,
      },
    });

    // Enroll real students in the course
    await prisma.accessCode.createMany({
      data: [
        { code: `CODE1_${timestamp}`, courseId: course.id, studentId: student1.id, isActive: true, usedAt: new Date() },
        { code: `CODE2_${timestamp}`, courseId: course.id, studentId: student2.id, isActive: true, usedAt: new Date() },
        { code: `CODE3_${timestamp}`, courseId: course.id, studentId: student3.id, isActive: true, usedAt: new Date() },
      ],
    });

    // 5. Create 1 QA Tester Account
    const testerPhone = `012${Math.floor(10000000 + Math.random() * 90000000)}`;
    const tester = await prisma.user.create({
      data: {
        name: `QA Platform Tester`,
        email: `tester_${testerPhone}@code-up.internal`,
        phone: testerPhone,
        role: "student",
        accountMode: "TESTER",
        testerCapabilities: JSON.stringify({
          bypassPayment: true,
          unlimitedWatches: true,
          isolatedExams: true,
          aiTesterContext: true,
        }),
        testerNotes: "Automated test runner account",
        password: hashedPassword,
        balance: 50, // Small test balance
        isActive: true,
      },
    });

    console.log("--- TEST GROUP 1: Single Authoritative Source of Truth & Helpers ---");
    assert(isTester(tester) === true, "isTester(tester) returns true when accountMode is TESTER");
    assert(isTester(student1) === false, "isTester(student1) returns false when accountMode is NORMAL");
    assert(canBypassPayment(tester) === true, "canBypassPayment(tester) returns true");
    assert(canWatchUnlimited(tester) === true, "canWatchUnlimited(tester) returns true");

    console.log("\n--- TEST GROUP 2: Tester Payment Bypass & Clean Entitlements ---");
    // Tester buys 500 EGP course with only 50 EGP balance
    const purchaseResult = await PurchaseService.purchaseCourse({
      studentId: tester.id,
      courseId: course.id,
      paymentMethod: "wallet_balance",
    });

    assert(purchaseResult.success === true, "Tester purchases 500 EGP course successfully without funds error");
    assert(purchaseResult.finalPrice === 0, "Tester purchase finalPrice is exactly 0 EGP");

    // Verify tester balance remained untouched at 50 EGP
    const freshTester = await prisma.user.findUnique({ where: { id: tester.id }, select: { balance: true } });
    assert(freshTester?.balance === 50, `Tester balance is untouched (expected 50, got ${freshTester?.balance})`);

    // Verify CourseEnrollment was created with fulfillmentSource = "TESTER_BYPASS"
    const directEnrollment = await prisma.courseEnrollment.findUnique({
      where: { studentId_courseId: { studentId: tester.id, courseId: course.id } },
    });
    assert(!!directEnrollment, "CourseEnrollment record was created");
    assert(directEnrollment?.fulfillmentSource === "TESTER_BYPASS", "fulfillmentSource is TESTER_BYPASS");
    assert(directEnrollment?.amountPaid === 0, "amountPaid is 0 EGP");

    // Verify NO dummy AccessCode was generated
    const testerAccessCode = await prisma.accessCode.findFirst({
      where: { studentId: tester.id, courseId: course.id },
    });
    assert(testerAccessCode === null, "No AccessCode was created for tester purchase (Clean Entitlement)");

    console.log("\n--- TEST GROUP 3: 4 Teacher Anti-Leak Invisibility Tests ---");

    // Anti-Leak Test 1: Direct-ID Attack (Teacher directly queries tester ID)
    const directLookup = await TeacherVisibilityService.findStudentById(teacher.id, tester.id);
    assert(directLookup === null, "Anti-Leak 1: Direct-ID lookup for tester returns null (404 Not Found)");

    const realStudentLookup = await TeacherVisibilityService.findStudentById(teacher.id, student1.id);
    assert(realStudentLookup !== null && realStudentLookup.id === student1.id, "Direct-ID lookup for real student succeeds");

    // Anti-Leak Test 2: Course Roster Count (3 real + 1 tester enrolled -> teacher sees 3)
    const teacherSeenCount = await TeacherVisibilityService.countCourseStudents(course.id);
    assert(teacherSeenCount === 3, `Anti-Leak 2: Course roster count strictly excludes tester (expected 3, got ${teacherSeenCount})`);

    // Enrolled students list check
    const enrolledStudents = await prisma.user.findMany({
      where: TeacherVisibilityService.getEnrolledStudentsWhere(course.id),
      select: { id: true, name: true, accountMode: true },
    });
    const containsTester = enrolledStudents.some((s) => s.accountMode === "TESTER" || s.id === tester.id);
    assert(!containsTester, "Anti-Leak 2b: Enrolled students list contains 0 testers");
    assert(enrolledStudents.length === 3, `Enrolled students list length is 3 (got ${enrolledStudents.length})`);

    // Anti-Leak Test 3: Teacher Revenue Boundary (Tester spent 0, teacher earned 0)
    const teacherTx = await prisma.balanceTransaction.findMany({
      where: { userId: teacher.id },
    });
    assert(teacherTx.length === 0, "Anti-Leak 3: Teacher received 0 financial ledger entries / commission from tester");

    // Anti-Leak Test 4: Search Immunity (Teacher searches by tester's phone/name)
    const teacherSearchResults = await prisma.user.findMany({
      where: {
        ...TeacherVisibilityService.getStudentWhereClause(),
        phone: tester.phone,
      },
    });
    assert(teacherSearchResults.length === 0, `Anti-Leak 4: Searching tester phone from teacher visibility returns 0 rows (got ${teacherSearchResults.length})`);

    console.log("\n--- TEST GROUP 4: QA Activity Logging & Audit Trail ---");
    await logTesterActivity({
      testerId: tester.id,
      action: "VIDEO_WATCH",
      targetId: video.id,
      targetTitle: video.title,
      details: { maxWatches: video.maxWatchesPerUser, unlimited: true },
    });

    const logs = await prisma.testerActivityLog.findMany({
      where: { testerId: tester.id },
      orderBy: { createdAt: "desc" },
    });
    assert(logs.length >= 2, `Tester activity logs recorded (got ${logs.length} entries, expected >= 2)`);
    assert(logs.some((l) => l.action === "PAYMENT_BYPASS"), "Audit log contains PAYMENT_BYPASS action");
    assert(logs.some((l) => l.action === "VIDEO_WATCH"), "Audit log contains VIDEO_WATCH action");

    // ── Teardown ─────────────────────────────────────────────────────────────────
    await prisma.testerActivityLog.deleteMany({ where: { testerId: tester.id } });
    await prisma.courseEnrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.accessCode.deleteMany({ where: { courseId: course.id } });
    await prisma.video.deleteMany({ where: { id: video.id } });
    await prisma.folder.deleteMany({ where: { id: folder.id } });
    await prisma.course.deleteMany({ where: { id: course.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [teacher.id, student1.id, student2.id, student3.id, tester.id] } },
    });

  } catch (error) {
    console.error("Test execution failed with error:", error);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
