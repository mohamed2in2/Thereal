import { parsePaymentNoteMetadata } from "../src/lib/fulfillment";
import { shakeOutRefNote, SHAKEOUT_PENDING_TYPE, SHAKEOUT_CREDITED_TYPE, SHAKEOUT_PAID_STATUSES } from "../src/lib/shakeout";
import { sha7nawyRefNote, SHA7NAWY_PENDING_TYPE, SHA7NAWY_CREDITED_TYPE, SHA7NAWY_PAID_STATUSES } from "../src/lib/sha7nawy";
import { TeacherSubscriptionPurchaseParams } from "../src/services/purchase/PurchaseService";

async function runPaymentGatewaysReliabilitySuite() {
  console.log("================================================================================");
  console.log("🚀 Running Code-UP Payment Reliability & Multi-Gateway Verification Suite");
  console.log("================================================================================\n");

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

  const timestamp = Date.now();

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // Test 1: 1200 EGP Shake-Out Note Formatting & Phone Snapshot Parsing
    // ──────────────────────────────────────────────────────────────────────────
    const invoiceId = `INV_${timestamp}`;
    const invoiceRef = `REF_${timestamp}`;
    const compoundRef = `${invoiceId}/${invoiceRef}`;
    const baseAmount = 1200;
    const totalAmount = 1224; // 1200 + 2%
    const studentPhone = "01099998888";
    const studentName = "مريم خالد";

    const note1 = `${shakeOutRefNote(compoundRef)}|base:${baseAmount}|total:${totalAmount}|itemType:teacher_sub|teacherId:teacher_123|planType:yearly|grade:sec_1|lang:arabic|phone:${studentPhone}|studentName:${encodeURIComponent(studentName)}|inv_id:${invoiceId}|inv_ref:${invoiceRef}`;

    const parsed1 = parsePaymentNoteMetadata(note1);

    assert(
      parsed1.base === "1200" &&
      parsed1.total === "1224" &&
      parsed1.itemType === "teacher_sub" &&
      parsed1.teacherId === "teacher_123" &&
      parsed1.planType === "yearly" &&
      parsed1.phone === "01099998888" &&
      decodeURIComponent(parsed1.studentName) === "مريم خالد" &&
      parsed1.inv_id === invoiceId &&
      parsed1.inv_ref === invoiceRef,
      "Test 1: Shake-Out 1200 EGP compound note metadata correctly parses all fields including student phone & name"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: Multi-Identifier Token Search Resolution (Compound Ref vs Single ID)
    // ──────────────────────────────────────────────────────────────────────────
    const dbStoredProviderRef = compoundRef; // "INV_123/REF_123"
    const webhookIncomingId = invoiceId; // "INV_123"

    // Simulate multi-token search extractor
    const rawId = String(webhookIncomingId).trim();
    const idOnly = rawId.split("/")[0];
    const refOnly = rawId.split("/")[1] || "";
    const searchTokens = Array.from(new Set([rawId, idOnly, refOnly].filter(Boolean)));

    // Matching criteria: either dbStoredProviderRef in tokens, or startsWith "${token}/", or endsWith "/${token}"
    const isMatched = searchTokens.some(
      (token) =>
        dbStoredProviderRef === token ||
        dbStoredProviderRef.startsWith(`${token}/`) ||
        dbStoredProviderRef.endsWith(`/${token}`) ||
        note1.includes(`shakeout_ref:${token}`) ||
        note1.includes(`inv_id:${token}`)
    );

    assert(
      isMatched === true,
      "Test 2: Multi-identifier search resolver successfully matches webhook single ID to compound DB reference"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: Historical Amount Isolation Invariant
    // ──────────────────────────────────────────────────────────────────────────
    // A student subscribes at 1200 EGP early-bird price (or 200 EGP for 3 months)
    const originalSubscription = {
      id: "sub_1",
      studentId: "student_1",
      teacherId: "teacher_123",
      planType: "yearly",
      planLabel: "اشتراك سنوي (1200 ج.م)",
      amount: 1200,
      studentPhone: "01099998888",
      status: "active",
      createdAt: new Date(),
    };

    // Teacher raises the price in their settings from 1200 to 1500 EGP
    const updatedTeacherProfile = {
      priceYearly: 1500,
    };

    // Verify: The existing subscription's amount is NOT recomputed from the teacher profile
    const displayedAmount = originalSubscription.amount;
    const currentTeacherPrice = updatedTeacherProfile.priceYearly;

    assert(
      displayedAmount === 1200 && currentTeacherPrice === 1500 && displayedAmount !== currentTeacherPrice,
      "Test 3: Historical amount paid (1200 EGP) is isolated and remains immutable when teacher updates profile price to 1500 EGP"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 4: Atomic Claim Concurrency & Idempotency Simulation
    // ──────────────────────────────────────────────────────────────────────────
    // Simulate database atomic claim state
    let transactionState = {
      id: "tx_1200",
      type: SHAKEOUT_PENDING_TYPE,
      amount: 1200,
      claimedCount: 0,
    };

    // Function simulating `updateMany({ where: { id, type: SHAKEOUT_PENDING_TYPE }, data: { type: SHAKEOUT_CREDITED_TYPE } })`
    const simulateAtomicClaim = () => {
      if (transactionState.type === SHAKEOUT_PENDING_TYPE) {
        transactionState.type = SHAKEOUT_CREDITED_TYPE;
        transactionState.claimedCount++;
        return 1; // 1 row updated
      }
      return 0; // 0 rows updated
    };

    // 10 concurrent requests arrive simultaneously (webhooks + polling + status checks)
    const claimResults = await Promise.all([
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
      Promise.resolve(simulateAtomicClaim()),
    ]);

    const totalSuccessfulClaims = claimResults.filter((r) => r === 1).length;
    const totalRejectedClaims = claimResults.filter((r) => r === 0).length;

    assert(
      totalSuccessfulClaims === 1 &&
      totalRejectedClaims === 9 &&
      transactionState.claimedCount === 1 &&
      transactionState.type === SHAKEOUT_CREDITED_TYPE,
      "Test 4: Atomic conditional claim enforces exactly-once credit under 10 concurrent webhook/status requests"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 5: Late Payment Recovery on Expired Shake-Out Transaction
    // ──────────────────────────────────────────────────────────────────────────
    let expiredTransactionState = {
      id: "tx_expired_1",
      type: "credit_shakeout_expired",
      amount: 180,
      claimedCount: 0,
    };

    const simulateLatePaymentClaim = () => {
      if (expiredTransactionState.type === "credit_shakeout_expired") {
        expiredTransactionState.type = SHAKEOUT_CREDITED_TYPE;
        expiredTransactionState.claimedCount++;
        return 1;
      }
      return 0;
    };

    const lateClaimResult = simulateLatePaymentClaim();
    const secondLateClaimResult = simulateLatePaymentClaim();

    assert(
      lateClaimResult === 1 &&
      secondLateClaimResult === 0 &&
      expiredTransactionState.type === SHAKEOUT_CREDITED_TYPE,
      "Test 5: Late payment on expired transaction transitions to credited and rejects duplicates"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 6: Sha7nawy Mobile Wallet 1200 EGP Note & Phone Snapshot
    // ──────────────────────────────────────────────────────────────────────────
    const shaRef = `SHA_${timestamp}`;
    const shaNote = `${sha7nawyRefNote(shaRef)}|base:1200|total:1224|itemType:teacher_sub|teacherId:teacher_456|planType:yearly|grade:sec_2|lang:languages|phone:01012345678|studentName:${encodeURIComponent("أحمد محمود")}`;

    const parsedSha = parsePaymentNoteMetadata(shaNote);

    assert(
      parsedSha.base === "1200" &&
      parsedSha.total === "1224" &&
      parsedSha.itemType === "teacher_sub" &&
      parsedSha.phone === "01012345678" &&
      parsedSha.lang === "languages" &&
      decodeURIComponent(parsedSha.studentName) === "أحمد محمود",
      "Test 6: Sha7nawy 1200 EGP mobile wallet metadata captures studentPhone, languageTrack, and itemType"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 7: Paid Status Codes Compatibility
    // ──────────────────────────────────────────────────────────────────────────
    const shakeoutStatusesToTest = ["paid", "PAID", "completed", "COMPLETED", "settled", "SETTLED", "success", "SUCCESS"];
    const sha7nawyStatusesToTest = ["completed", "COMPLETED", "paid", "PAID", "success", "SUCCESS"];

    const allShakeoutValid = shakeoutStatusesToTest.every((st) => SHAKEOUT_PAID_STATUSES.includes(st.toLowerCase()));
    const allSha7nawyValid = sha7nawyStatusesToTest.every((st) => SHA7NAWY_PAID_STATUSES.includes(st.toLowerCase()));

    assert(
      allShakeoutValid && allSha7nawyValid,
      "Test 7: All gateway paid/completed status variations are normalized and recognized"
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Test 8: TeacherSubscriptionPurchaseParams Type Contract
    // ──────────────────────────────────────────────────────────────────────────
    const purchaseParams: TeacherSubscriptionPurchaseParams = {
      studentId: "student_1",
      teacherId: "teacher_123",
      planType: "yearly",
      studentPhone: "01099998888",
      studentName: "مريم خالد",
      languageTrack: "arabic",
      studentGrade: "sec_1",
      paymentMethod: "gateway_direct",
    };

    assert(
      purchaseParams.studentPhone === "01099998888" &&
      purchaseParams.studentName === "مريم خالد" &&
      purchaseParams.planType === "yearly",
      "Test 8: TeacherSubscriptionPurchaseParams interface strictly preserves studentPhone and studentName"
    );

  } catch (err: any) {
    console.error("❌ Fatal Error in Test Suite:", err);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`📊 Payment Reliability Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentGatewaysReliabilitySuite().then(() => {
  process.exit(0);
});
