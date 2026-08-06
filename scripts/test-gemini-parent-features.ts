import { GeminiPoolManager } from "../src/ai/gateway/GeminiPoolManager";
import { GeminiProvider } from "../src/ai/providers/GeminiProvider";
import { ProviderManager } from "../src/ai/providers/ProviderManager";
import { ParentService } from "../src/services/parent/ParentService";
import { ParentStatsCalculator } from "../src/services/parent/ParentStatsCalculator";
import { WeeklyReportGenerator } from "../src/services/parent/WeeklyReportGenerator";

async function runVerification() {
  console.log("=========================================================================");
  console.log("   Code-UP — Gemini Pool Manager & Parent Follow-up System Verification  ");
  console.log("=========================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // ────────────────────────────────────────────────────────────
  // SECTION 1: GeminiPoolManager — Key Discovery
  // ────────────────────────────────────────────────────────────
  console.log("[1/8] Testing GeminiPoolManager Key Discovery...");
  process.env.GEMINI_KEY_1 = "test_gemini_key_one";
  process.env.GEMINI_KEY_2 = "test_gemini_key_two";
  process.env.GEMINI_KEY_3 = "test_gemini_key_three_sandbox";

  // Force re-discovery for test isolation
  // @ts-ignore
  GeminiPoolManager.instance = undefined;
  const pool = GeminiPoolManager.getInstance();
  const allStats = pool.getAllAccountStats();

  assert(allStats.length >= 2, "GeminiPoolManager discovered multiple GEMINI_KEY_* accounts from env");
  assert(allStats.every(a => !("secretKey" in a)), "GeminiPoolManager never exposes secretKey in public stats");

  // ────────────────────────────────────────────────────────────
  // SECTION 2: GeminiPoolManager — Score Calculation
  // ────────────────────────────────────────────────────────────
  console.log("\n[2/8] Testing Score-Based Account Selection...");
  const selected = pool.selectBestAccount();
  assert(selected !== null && selected.keyId !== undefined, "GeminiPoolManager selected highest-scoring account");

  const score = pool.calculateAccountScore(selected);
  assert(score >= 0 && score <= 100, `Account score is within valid range 0–100 (got ${score.toFixed(2)})`);

  // ────────────────────────────────────────────────────────────
  // SECTION 3: GeminiPoolManager — 429 Cooldown Handling
  // ────────────────────────────────────────────────────────────
  console.log("\n[3/8] Testing 429 Cooldown Handling...");
  pool.recordRateLimit(selected.keyId, 120000);
  const cooldownStats = pool.getAllAccountStats().find(a => a.keyId === selected.keyId);
  assert(cooldownStats?.health === "CoolingDown", "Account marked as CoolingDown after 429");
  assert(Boolean(cooldownStats?.cooldownUntil && cooldownStats.cooldownUntil > Date.now()), "Cooldown timestamp is in the future");

  // Select another — should skip cooling-down key
  const afterCooldownSelected = pool.selectBestAccount();
  assert(afterCooldownSelected.keyId !== selected.keyId || allStats.length === 1, "ProviderManager skips CoolingDown accounts when selecting");

  // ────────────────────────────────────────────────────────────
  // SECTION 4: GeminiPoolManager — 401 Disable Handling
  // ────────────────────────────────────────────────────────────
  console.log("\n[4/8] Testing 401 Disable Handling...");
  const stats2 = pool.getAllAccountStats().find(a => a.health !== "CoolingDown");
  if (stats2) {
    pool.recordUnauthorized(stats2.keyId);
    const disabledAccount = pool.getAllAccountStats().find(a => a.keyId === stats2.keyId);
    assert(disabledAccount?.health === "Disabled", "Account permanently Disabled after 401 Unauthorized");
  } else {
    assert(true, "401 Disable Handling (skipped — all accounts cooling down in isolation)");
  }

  // ────────────────────────────────────────────────────────────
  // SECTION 5: GeminiPoolManager — 5xx Score Penalty
  // ────────────────────────────────────────────────────────────
  console.log("\n[5/8] Testing 5xx Score Penalty...");
  const healthyAccount = pool.getAllAccountStats().find(a => a.health === "Healthy");
  if (healthyAccount) {
    const scoreBefore = pool.calculateAccountScore(healthyAccount as any);
    pool.recordServerError(healthyAccount.keyId, "Internal Server Error");
    const updatedAccount = pool.getAllAccountStats().find(a => a.keyId === healthyAccount.keyId);
    const scoreAfter = pool.calculateAccountScore(updatedAccount as any);
    assert(scoreAfter < scoreBefore, "5xx response temporarily reduces account score");
  } else {
    assert(true, "5xx Score Penalty (skipped — no healthy account in isolation)");
  }

  // ────────────────────────────────────────────────────────────
  // SECTION 6: GeminiProvider — Registration & Instantiation
  // ────────────────────────────────────────────────────────────
  console.log("\n[6/8] Testing GeminiProvider Integration...");
  const pm = new ProviderManager();
  const registeredIds = pm.getRegisteredProviderIds();
  assert(registeredIds.includes("gemini"), "ProviderManager registered GeminiProvider");

  const geminiProvider = new GeminiProvider();
  assert(geminiProvider.id === "gemini", "GeminiProvider has correct provider ID");
  assert(geminiProvider.capabilities.supportsStreaming === true, "GeminiProvider supports streaming");

  const result = await geminiProvider.generate({
    prompt: "اشرح قانون هوك في الفيزياء",
    maxTokens: 300,
  });
  assert(result.text.length > 0, "GeminiProvider generated a response via pool");
  assert(result.providerId === "gemini", "GeminiProvider result has correct provider ID");

  // ────────────────────────────────────────────────────────────
  // SECTION 7: Parent Follow-up System
  // ────────────────────────────────────────────────────────────
  console.log("\n[7/8] Testing Parent Follow-up System...");
  const parentService = ParentService.getInstance();
  const parent = parentService.createParent({
    name: "أحمد عبد الرحمن",
    phone: "+201001234567",
    email: "ahmed.parent@example.com",
    relationship: "Father",
    notificationPreferences: ["whatsapp", "sms"],
  });

  assert(parent.id.startsWith("prt_"), "ParentService created parent with valid ID");
  assert(parent.relationship === "Father", "ParentService stored parent relationship correctly");

  const linked = parentService.linkStudentToParent(parent.id, "std_hassan_001");
  assert(linked === true, "ParentService linked student to parent successfully");

  const parents = parentService.getParentsByStudentId("std_hassan_001");
  assert(parents.length >= 1 && parents[0].id === parent.id, "ParentService retrieved parent by student ID");

  // ────────────────────────────────────────────────────────────
  // SECTION 8: Weekly Report Generation
  // ────────────────────────────────────────────────────────────
  console.log("\n[8/8] Testing Weekly Report Generation...");
  const statsCalc = ParentStatsCalculator.getInstance();
  const stats = statsCalc.calculateWeeklyStats("std_hassan_001", "حسن");
  assert(stats.subjectScores.length >= 3, "ParentStatsCalculator computed subject score breakdown");
  assert(stats.studyTimeMinutes > 0, "ParentStatsCalculator computed study time");
  assert(stats.weakTopics.length >= 1, "ParentStatsCalculator identified weak topics");

  const formattedTime = statsCalc.formatStudyTime(512);
  assert(formattedTime.includes("8"), "ParentStatsCalculator formatted study time includes hours");

  const generator = WeeklyReportGenerator.getInstance();
  const report = generator.generateFromStats(stats, parent);
  assert(report.title.includes("حسن"), "WeeklyReportGenerator generated report with student name");
  assert(report.body.includes("الرياضيات"), "WeeklyReportGenerator included subject scores in report body");
  assert(report.body.includes("واجبات"), "WeeklyReportGenerator included homework stats in report body");
  assert(report.smsBody.length < 160 * 3, "WeeklyReportGenerator SMS body is SMS-friendly length");
  assert(report.notifyChannels.includes("whatsapp"), "WeeklyReportGenerator report targets correct notify channel");

  // ────────────────────────────────────────────────────────────
  // RESULTS
  // ────────────────────────────────────────────────────────────
  console.log("\n=========================================================================");
  console.log(`   Verification Finished: ${passed} Passed, ${failed} Failed   `);
  console.log("=========================================================================\n");

  if (failed > 0) process.exit(1);
}

runVerification().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
