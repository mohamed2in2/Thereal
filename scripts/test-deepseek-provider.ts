import {
  AIEngine,
  AdaptiveCostMode,
  DailyBudgetManager,
  DeepSeekV4FlashProvider,
  PromptBudgetManager,
  ProviderManager,
  RequestDeduplicator,
  SimilarQuestionDetector,
} from "../src/ai";

async function runDeepSeekVerification() {
  console.log("=========================================================================");
  console.log("   Code-UP AI Engine - DeepSeek V4 Flash & Cost Routing Verification    ");
  console.log("=========================================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      testsFailed++;
    }
  }

  // 1. Provider Instantiation & Credentials
  console.log(`[1/8] Testing DeepSeekV4FlashProvider Instantiation & Config...`);
  const deepseekProvider = new DeepSeekV4FlashProvider();
  assert(deepseekProvider.id === "deepseek_v4_flash", "Provider ID matches 'deepseek_v4_flash'");
  assert(deepseekProvider.capabilities.supportsStreaming === true, "Provider capabilities report streaming support");
  assert(deepseekProvider.capabilities.maxContextTokens === 64000, "Provider capabilities report 64k max context");

  // 2. Provider Registration
  console.log(`\n[2/8] Testing ProviderManager Registration...`);
  const pm = new ProviderManager();
  const registeredIds = pm.getRegisteredProviderIds();
  assert(registeredIds.includes("deepseek_v4_flash"), "ProviderManager registered DeepSeek V4 Flash provider");

  // 3. Prompt Budget Manager
  console.log(`\n[3/8] Testing PromptBudgetManager Action Token Budgets...`);
  const greetingBudget = PromptBudgetManager.getBudgetForAction("GREETING");
  assert(greetingBudget === 300, "GREETING action budget is 300 tokens");

  const solveBudget = PromptBudgetManager.getBudgetForAction("SOLVE");
  assert(solveBudget === 2500, "SOLVE action budget is 2500 tokens");

  const examBudget = PromptBudgetManager.getBudgetForAction("EXAM");
  assert(examBudget === 3500, "EXAM action budget is 3500 tokens");

  // 4. Similar Question Detector (>90% similarity)
  console.log(`\n[4/8] Testing SimilarQuestionDetector Cache...`);
  const sqd = SimilarQuestionDetector.getInstance();
  sqd.recordAnswer("ما هو قانون نيوتن الأول؟", "قانون نيوتن الأول يسمى قانون القصور الذاتي.");

  const similarHit = sqd.findSimilarAnswer("ما هو قانون نيوتن الاول؟", 0.9);
  assert(similarHit !== null && similarHit.includes("القصور الذاتي"), "SimilarQuestionDetector reused cached answer for 90%+ similar query");

  // 5. Request Deduplicator
  console.log(`\n[5/8] Testing RequestDeduplicator...`);
  const deduplicator = RequestDeduplicator.getInstance();
  let executionCount = 0;

  const fn = async () => {
    executionCount++;
    return "Result";
  };

  const p1 = deduplicator.deduplicate("dedup_key_1", fn);
  const p2 = deduplicator.deduplicate("dedup_key_1", fn);

  const [res1, res2] = await Promise.all([p1, p2]);
  assert(res1 === "Result" && res2 === "Result" && executionCount === 1, "RequestDeduplicator deduplicated concurrent identical requests to 1 execution");

  // 6. Daily Budget Manager
  console.log(`\n[6/8] Testing DailyBudgetManager Spending Limits...`);
  const budgetMgr = DailyBudgetManager.getInstance();
  const allowedCheck = budgetMgr.checkBudget("std_1", 0.05);
  assert(allowedCheck.allowed === true, "DailyBudgetManager allowed request within budget");

  budgetMgr.setConfig({ maxDailyCostUsd: 0.001 });
  budgetMgr.recordSpent("std_1", 0.002);
  const blockedCheck = budgetMgr.checkBudget("std_1", 0.05);
  assert(blockedCheck.allowed === false, "DailyBudgetManager blocked request when daily budget limit exceeded");

  budgetMgr.setConfig({ maxDailyCostUsd: 50.0 }); // Reset config

  // 7. Adaptive Cost Mode
  console.log(`\n[7/8] Testing AdaptiveCostMode Configs...`);
  const costMode = AdaptiveCostMode.getInstance();
  costMode.setMode("Economy");
  const ecoConfig = costMode.getModeConfig();
  assert(ecoConfig.mode === "Economy" && ecoConfig.useAggressiveCache === true, "AdaptiveCostMode configured Economy aggressive caching mode");
  costMode.setMode("Balanced");

  // 8. End-to-End AIEngine Process Request with DeepSeek Provider
  console.log(`\n[8/8] Testing End-to-End AIEngine Integration...`);
  const engine = new AIEngine();
  const engineRes = await engine.processRequest({
    userMessage: "اشرح المتغيرات في لغة البايثون",
    studentId: "std_deepseek_test",
    subject: "برمجة",
  });

  assert(Boolean(engineRes.success), "AIEngine processed request cleanly");
  assert(engineRes.formattedResponse.renderedContent.length > 0, "AIEngine generated formatted educational response");

  console.log("\n=========================================================================");
  console.log(`   Verification Finished: ${testsPassed} Passed, ${testsFailed} Failed   `);
  console.log("=========================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runDeepSeekVerification().catch((err) => {
  console.error("DeepSeek verification script error:", err);
  process.exit(1);
});
