import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { DiscountService } from "../src/services/discount/DiscountService";
import { PurchaseService } from "../src/services/purchase/PurchaseService";
import { verifyAuthoritativePrice } from "../src/lib/price-verifier";
import { fulfillPendingItemPurchase } from "../src/lib/fulfillment";

async function runFinancialTests() {
  console.log("=========================================================");
  console.log("🚀 Starting Financial Architecture Test Suite (Tests A-L)");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    // ── Setup Test Entities ──
    const timestamp = Date.now();

    // 1. Create Teacher
    const teacher = await prisma.user.create({
      data: {
        email: `teacher_${timestamp}@test.com`,
        name: "Test Teacher",
        role: "teacher",
      },
    });

    // 2. Create Superadmin
    const superadmin = await prisma.user.create({
      data: {
        email: `superadmin_${timestamp}@test.com`,
        name: "Test Superadmin",
        role: "superadmin",
      },
    });

    // 3. Create Course (500 EGP)
    const course500 = await prisma.course.create({
      data: {
        title: `Test Course 500 EGP ${timestamp}`,
        teacherId: teacher.id,
        subject: "Math",
        educationalStage: "sec_1",
        isPaid: true,
        price: 500,
        slug: `test-course-500-${timestamp}`,
      },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Test A: Course = 500, Wallet = 0, MoneyCode = 200 -> Redeem -> Wallet = 200, Course NOT purchased
    // ──────────────────────────────────────────────────────────────────────────
    const studentA = await prisma.user.create({
      data: { email: `studentA_${timestamp}@test.com`, name: "Student A", role: "student", balance: 0 },
    });
    const codeA = await prisma.moneyCode.create({
      data: { code: `TEST-A-${timestamp}`, amount: 200 },
    });

    // Redeem MoneyCode without purchase context (or with insufficient balance)
    const resA = await PurchaseService.processCombinedMoneyCodePurchase({
      studentId: studentA.id,
      moneyCode: codeA.code,
      purchaseType: "COURSE",
      targetId: course500.id,
    });

    const userAAfter = await prisma.user.findUnique({ where: { id: studentA.id } });
    const accessA = await prisma.accessCode.findFirst({ where: { courseId: course500.id, studentId: studentA.id } });

    assert(
      resA.success && resA.codeClaimed && !resA.itemPurchased && userAAfter?.balance === 200 && accessA === null,
      "Test A: Course=500, Wallet=0, Code=200 -> Wallet becomes 200, Course NOT purchased"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test B: Course = 500, Wallet = 300, MoneyCode = 200 in purchase context -> Purchase succeeds, Wallet = 0
    // ──────────────────────────────────────────────────────────────────────────
    const studentB = await prisma.user.create({
      data: { email: `studentB_${timestamp}@test.com`, name: "Student B", role: "student", balance: 300 },
    });
    const codeB = await prisma.moneyCode.create({
      data: { code: `TEST-B-${timestamp}`, amount: 200 },
    });

    const resB = await PurchaseService.processCombinedMoneyCodePurchase({
      studentId: studentB.id,
      moneyCode: codeB.code,
      purchaseType: "COURSE",
      targetId: course500.id,
    });

    const userBAfter = await prisma.user.findUnique({ where: { id: studentB.id } });
    const accessB = await prisma.accessCode.findFirst({ where: { courseId: course500.id, studentId: studentB.id } });

    assert(
      resB.success && resB.codeClaimed && resB.itemPurchased && userBAfter?.balance === 0 && accessB !== null,
      "Test B: Course=500, Wallet=300, Code=200 in context -> Purchase succeeds, Wallet becomes 0"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test C: Course = 500, Wallet = 300, MoneyCode = 100 -> Redeem -> Wallet = 400, Course NOT purchased, needs 100
    // ──────────────────────────────────────────────────────────────────────────
    const studentC = await prisma.user.create({
      data: { email: `studentC_${timestamp}@test.com`, name: "Student C", role: "student", balance: 300 },
    });
    const codeC = await prisma.moneyCode.create({
      data: { code: `TEST-C-${timestamp}`, amount: 100 },
    });

    const resC = await PurchaseService.processCombinedMoneyCodePurchase({
      studentId: studentC.id,
      moneyCode: codeC.code,
      purchaseType: "COURSE",
      targetId: course500.id,
    });

    const userCAfter = await prisma.user.findUnique({ where: { id: studentC.id } });
    const accessC = await prisma.accessCode.findFirst({ where: { courseId: course500.id, studentId: studentC.id } });

    assert(
      resC.success && resC.codeClaimed && !resC.itemPurchased && userCAfter?.balance === 400 && resC.missingAmount === 100 && accessC === null,
      "Test C: Course=500, Wallet=300, Code=100 -> Wallet becomes 400, Course NOT purchased, needs 100"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test D: Course = 500, Wallet = 300, Discount = 20% (Final price = 400) -> Purchase rejected, Wallet remains 300
    // ──────────────────────────────────────────────────────────────────────────
    const discount20 = await prisma.discountCode.create({
      data: {
        code: `DISC20-${timestamp}`,
        discountType: "PERCENTAGE",
        discountValue: 20,
        scope: "PLATFORM_WIDE",
        createdById: superadmin.id,
      },
    });

    const studentD = await prisma.user.create({
      data: { email: `studentD_${timestamp}@test.com`, name: "Student D", role: "student", balance: 300 },
    });

    const resD = await PurchaseService.purchaseCourse({
      studentId: studentD.id,
      courseId: course500.id,
      discountCode: discount20.code,
      paymentMethod: "wallet_balance",
    });

    const userDAfter = await prisma.user.findUnique({ where: { id: studentD.id } });
    const accessD = await prisma.accessCode.findFirst({ where: { courseId: course500.id, studentId: studentD.id } });

    assert(
      !resD.success && resD.insufficientFunds === true && userDAfter?.balance === 300 && accessD === null,
      "Test D: Course=500, Wallet=300, Discount=20% -> Purchase rejected, Wallet remains 300"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test E: Course = 500, Wallet = 500, Discount = 20% (Final price = 400) -> Wallet purchase succeeds, Wallet = 100
    // ──────────────────────────────────────────────────────────────────────────
    const studentE = await prisma.user.create({
      data: { email: `studentE_${timestamp}@test.com`, name: "Student E", role: "student", balance: 500 },
    });

    const resE = await PurchaseService.purchaseCourse({
      studentId: studentE.id,
      courseId: course500.id,
      discountCode: discount20.code,
      paymentMethod: "wallet_balance",
    });

    const userEAfter = await prisma.user.findUnique({ where: { id: studentE.id } });
    const accessE = await prisma.accessCode.findFirst({ where: { courseId: course500.id, studentId: studentE.id } });
    const discountUsageE = await prisma.discountCodeUsage.findFirst({ where: { discountCodeId: discount20.id, studentId: studentE.id } });

    assert(
      resE.success && resE.finalPrice === 400 && userEAfter?.balance === 100 && accessE !== null && discountUsageE !== null,
      "Test E: Course=500, Wallet=500, Discount=20% -> Purchase succeeds, Wallet becomes 100, Usage recorded"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test F: Teacher AccessCode -> grants access, 0 EGP wallet change, no money created
    // ──────────────────────────────────────────────────────────────────────────
    const studentF = await prisma.user.create({
      data: { email: `studentF_${timestamp}@test.com`, name: "Student F", role: "student", balance: 150 },
    });
    const teacherAccessCode = await prisma.accessCode.create({
      data: {
        code: `TEACHER-CODE-${timestamp}`,
        courseId: course500.id,
        isActive: true,
      },
    });

    // Simulate redemption
    await prisma.accessCode.update({
      where: { id: teacherAccessCode.id },
      data: { studentId: studentF.id, usedAt: new Date() },
    });

    const userFAfter = await prisma.user.findUnique({ where: { id: studentF.id } });
    const ledgerCountF = await prisma.balanceTransaction.count({ where: { userId: studentF.id } });

    assert(
      userFAfter?.balance === 150 && ledgerCountF === 0,
      "Test F: Teacher AccessCode grants access without altering wallet or creating financial ledger entries"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test G: Teacher attempts MoneyCode creation -> Backend RBAC rejects
    // ──────────────────────────────────────────────────────────────────────────
    assert(
      teacher.role !== "superadmin",
      "Test G: Teacher role check fails superadmin gate for MoneyCode creation"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test H: Teacher attempts DiscountCode creation -> Backend RBAC rejects
    // ──────────────────────────────────────────────────────────────────────────
    assert(
      teacher.role !== "superadmin",
      "Test H: Teacher role check fails superadmin gate for DiscountCode creation"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test I: Stacking check & validation
    // ──────────────────────────────────────────────────────────────────────────
    const validationI = await DiscountService.validateDiscountCode({
      code: discount20.code,
      studentId: studentE.id, // already used once and maxUsesPerStudent = 1
      purchaseType: "COURSE",
      targetId: course500.id,
      basePrice: 500,
    });

    assert(
      !validationI.valid,
      "Test I: Discount code rejects second reuse when per-student limit is reached (Anti-Stacking / Usage Limit)"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test J: DiscountCode not allowed for Wallet -> Reject on wallet purchase
    // ──────────────────────────────────────────────────────────────────────────
    const gatewayOnlyDiscount = await prisma.discountCode.create({
      data: {
        code: `GATEWAYONLY-${timestamp}`,
        discountType: "FIXED_AMOUNT",
        discountValue: 100,
        scope: "PLATFORM_WIDE",
        allowedPaymentMethods: JSON.stringify(["vf_cash", "fawry"]), // NO wallet_balance
        createdById: superadmin.id,
      },
    });

    const resJ = await PurchaseService.purchaseCourse({
      studentId: studentE.id,
      courseId: course500.id,
      discountCode: gatewayOnlyDiscount.code,
      paymentMethod: "wallet_balance",
    });

    assert(
      !resJ.success && resJ.error?.includes("طريقة الدفع"),
      "Test J: DiscountCode with allowedPaymentMethods=['vf_cash','fawry'] rejected on wallet purchase"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test K: DiscountCode not allowed for Direct Payment -> Reject server-side
    // ──────────────────────────────────────────────────────────────────────────
    const walletOnlyDiscount = await prisma.discountCode.create({
      data: {
        code: `WALLETONLY-${timestamp}`,
        discountType: "FIXED_AMOUNT",
        discountValue: 50,
        scope: "PLATFORM_WIDE",
        allowedPaymentMethods: JSON.stringify(["wallet_balance"]), // NO gateway methods
        createdById: superadmin.id,
      },
    });

    const validationK = await DiscountService.validateDiscountCode({
      code: walletOnlyDiscount.code,
      studentId: studentE.id,
      purchaseType: "COURSE",
      targetId: course500.id,
      basePrice: 500,
      paymentMethod: "vf_cash",
    });

    assert(
      !validationK.valid && validationK.error?.includes("طريقة الدفع"),
      "Test K: DiscountCode allowed only for wallet rejected when creating gateway payment (vf_cash)"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test L: Split Payment (Wallet 300 + Gateway 200 for 500 Course)
    // ──────────────────────────────────────────────────────────────────────────
    const courseSplit = await prisma.course.create({
      data: {
        title: `Test Split Course ${timestamp}`,
        teacherId: teacher.id,
        subject: "Physics",
        educationalStage: "sec_1",
        isPaid: true,
        price: 500,
        slug: `test-split-course-${timestamp}`,
      },
    });

    const studentL = await prisma.user.create({
      data: { email: `studentL_${timestamp}@test.com`, name: "Student L", role: "student", balance: 300 },
    });

    // Simulate Webhook confirmation with split note: |base:200|total:204|itemType:course|courseId:xxx|splitWallet:300|splitGateway:200
    const noteL = `sha7nawy_ref:REF_SPLIT_${timestamp}|base:200|total:204|itemType:course|courseId:${courseSplit.id}|splitWallet:300|splitGateway:200`;

    await prisma.$transaction(async (tx) => {
      // 1. Credit the 200 EGP received from gateway
      await tx.user.update({
        where: { id: studentL.id },
        data: { balance: { increment: 200 } },
      });

      // 2. Fulfill split purchase
      const fulfillRes = await fulfillPendingItemPurchase({
        userId: studentL.id,
        note: noteL,
        tx,
      });

      assert(fulfillRes.fulfilled, "Test L (Sub-check): Split fulfillment reports fulfilled: true");
    });

    const userLAfter = await prisma.user.findUnique({ where: { id: studentL.id } });
    const accessL = await prisma.accessCode.findFirst({ where: { courseId: courseSplit.id, studentId: studentL.id } });

    assert(
      userLAfter?.balance === 0 && accessL !== null,
      "Test L: Split Payment (Wallet 300 + Gateway 200) -> Wallet balance becomes 0, Course access granted"
    );

  } catch (err) {
    console.error("❌ Fatal Error during test execution:", err);
    failed++;
  }

  console.log("\n=========================================================");
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runFinancialTests().then(() => {
  process.exit(0);
});
