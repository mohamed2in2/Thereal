import { processTeacherAttribution } from "../src/lib/referral";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTeacherReferralTests() {
  console.log("===========================================================================");
  console.log("   Code-UP Verification — Teacher Promo-Code Program (\"Referred Students\")  ");
  console.log("===========================================================================\n");

  const now = new Date();
  const testSuffix = Date.now().toString(36);

  // In-memory mock database state
  const mockDb = {
    users: [
      {
        id: "teacher_a",
        name: "Teacher A",
        role: "teacher",
        promoProgramEnabled: true,
        promoCode: "CODE123",
        promoCodeCreatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10d ago
      },
      {
        id: "teacher_b",
        name: "Teacher B",
        role: "teacher",
        promoProgramEnabled: true,
        promoCode: "CODE456",
        promoCodeCreatedAt: new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000), // 360d ago (expired)
      },
      {
        id: "student_1",
        name: "Student 1",
        role: "student",
        referredByTeacherId: "teacher_a",
      },
      {
        id: "student_2",
        name: "Student 2",
        role: "student",
        referredByTeacherId: null,
      },
    ],
    attributions: [] as any[],
  };

  const mockTx = {
    user: {
      findFirst: async ({ where }: any) => {
        return mockDb.users.find(
          (u) =>
            u.role === where.role &&
            u.promoProgramEnabled === where.promoProgramEnabled &&
            u.promoCode === where.promoCode
        ) || null;
      },
      findUnique: async ({ where }: any) => {
        return mockDb.users.find((u) => u.id === where.id) || null;
      },
    },
    teacherReferralAttribution: {
      create: async ({ data }: any) => {
        const record = { id: `attr_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
        mockDb.attributions.push(record);
        return record;
      },
    },
  };

  // 1. Test 350-day Expiry Rule:
  // Promo code CODE123 (10d old) should be valid; CODE456 (360d old) should be expired.
  const isWithin350Days = (dt: Date) => now.getTime() - dt.getTime() <= 350 * 24 * 60 * 60 * 1000;
  assert(isWithin350Days(mockDb.users[0].promoCodeCreatedAt!) === true, "10-day old promo code is valid (<350d)");
  assert(isWithin350Days(mockDb.users[1].promoCodeCreatedAt!) === false, "360-day old promo code is expired (>350d)");

  // 2. Case A: Student 2 buys Teacher A's content with valid promo code "CODE123"
  await processTeacherAttribution({
    studentId: "student_2",
    teacherIdOfContent: "teacher_a",
    amount: 150,
    purchaseType: "COURSE",
    courseId: "course_1",
    promoCodeInput: "code123",
    tx: mockTx,
  });

  assert(mockDb.attributions.length === 1, "Case A creates 1 attribution record");
  assert(mockDb.attributions[0].teacherId === "teacher_a", "Case A attributes to Teacher A");
  assert(mockDb.attributions[0].amount === 150, "Case A attributes 150 EGP");
  assert(mockDb.attributions[0].promoCodeUsed === "CODE123", "Case A records promoCodeUsed");

  // 3. Case A with expired promo code: Student 2 tries to use expired "CODE456" for Teacher B
  const lenBefore = mockDb.attributions.length;
  await processTeacherAttribution({
    studentId: "student_2",
    teacherIdOfContent: "teacher_b",
    amount: 200,
    purchaseType: "COURSE",
    courseId: "course_2",
    promoCodeInput: "CODE456",
    tx: mockTx,
  });
  assert(mockDb.attributions.length === lenBefore, "Expired promo code does NOT create attribution");

  // 4. Case B: Student 1 (referred by Teacher A on signup) buys Teacher A's folder for 80 EGP
  await processTeacherAttribution({
    studentId: "student_1",
    teacherIdOfContent: "teacher_a",
    amount: 80,
    purchaseType: "FOLDER",
    folderId: "folder_1",
    tx: mockTx,
  });

  const student1Attr = mockDb.attributions.find((a) => a.studentId === "student_1");
  assert(student1Attr != null, "Case B signup referral creates attribution when buying teacher's own content");
  assert(student1Attr.amount === 80, "Case B attributes 80 EGP to Teacher A");

  // 5. Scoping Check: Student 1 (referred by Teacher A) buys Teacher B's video for 50 EGP
  const teacherAAttrsCountBefore = mockDb.attributions.filter((a) => a.teacherId === "teacher_a").length;
  await processTeacherAttribution({
    studentId: "student_1",
    teacherIdOfContent: "teacher_b",
    amount: 50,
    purchaseType: "VIDEO",
    videoId: "video_1",
    tx: mockTx,
  });

  const teacherAAttrsCountAfter = mockDb.attributions.filter((a) => a.teacherId === "teacher_a").length;
  assert(
    teacherAAttrsCountBefore === teacherAAttrsCountAfter,
    "Scoping enforced: Buying Teacher B content does NOT attribute revenue to Teacher A"
  );

  // 6. Verify total money sum calculation
  const totalTeacherA = mockDb.attributions
    .filter((a) => a.teacherId === "teacher_a")
    .reduce((sum, a) => sum + a.amount, 0);

  assert(totalTeacherA === 230, "Teacher A total revenue equals 230 EGP (150 + 80)");

  console.log("\n===========================================================================");
  console.log("   Teacher Promo-Code Program Verification: ALL TESTS PASSED SUCCESSFULLY!  ");
  console.log("===========================================================================");
}

runTeacherReferralTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
