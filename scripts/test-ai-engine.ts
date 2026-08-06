import {
  AIEngine,
  ActionRegistry,
  ConfigManager,
  ContextBuilder,
  KnowledgeLoader,
  MockProvider,
  OpenAICompatibleProvider,
  ProviderManager,
  Telemetry,
} from "../src/ai";

async function runVerification() {
  console.log("=================================================");
  console.log("   Code-UP AI Engine - Milestone 1 Verification   ");
  console.log("=================================================\n");

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

  // Test 1: Action Registry - Verify all 22 Educational Actions exist
  const registry = ActionRegistry.getInstance();
  const registeredTypes = registry.getSupportedTypes();
  console.log(`[1/6] Testing Educational Actions Registration...`);
  console.log(`Registered Actions Count: ${registeredTypes.length}`);

  const required22Actions = [
    "EXPLAIN",
    "SIMPLIFY",
    "SOLVE",
    "HINT",
    "QUIZ",
    "HOMEWORK",
    "REVIEW",
    "FLASHCARDS",
    "SUMMARY",
    "REVISION",
    "COMPARE",
    "EXAM",
    "PLAN",
    "NEXT_LESSON",
    "RECOMMEND",
    "MEMORY_TRICK",
    "MOTIVATE",
    "ANALYZE_PROGRESS",
    "PARENT_REPORT",
    "TEACHER_REPORT",
    "SEARCH_PLATFORM",
  ];

  const missingActions = required22Actions.filter((a) => !registeredTypes.includes(a as any));
  assert(missingActions.length === 0, `All 22 required Educational Actions exist (Missing: ${missingActions.join(", ") || "None"})`);

  // Test 2: Knowledge Loader Selective Loading
  console.log(`\n[2/6] Testing Knowledge Loader Selective Filter...`);
  const knowledgeLoader = new KnowledgeLoader();
  const mathKnowledge = knowledgeLoader.loadKnowledge("رياضيات");
  const progKnowledge = knowledgeLoader.loadKnowledge("برمجه عملي");

  assert(mathKnowledge.subject === "رياضيات", "Math subject knowledge loaded correctly");
  assert(
    !JSON.stringify(mathKnowledge).includes("الكيمياء") &&
    !JSON.stringify(mathKnowledge).includes("الأحياء"),
    "Knowledge loader strictly excludes irrelevant subjects (Chemistry/Biology)"
  );
  assert(progKnowledge.subject === "برمجه عملي", "Programming subject knowledge loaded correctly");

  // Test 3: Provider Abstraction & Fallback Chain
  console.log(`\n[3/6] Testing Provider Abstraction & Fallback Chain...`);
  const providerManager = new ProviderManager("failing_provider", ["mock"]);
  
  // Register a provider that throws error
  providerManager.registerProvider({
    id: "failing_provider",
    name: "Failing Test Provider",
    capabilities: { supportsStreaming: false, supportsEmbeddings: false, supportsVision: false, maxContextTokens: 1000 },
    generate: async () => { throw new Error("Simulated API failure"); },
    stream: async function* () {
      yield { delta: "", done: true };
      return { fullText: "", providerId: "failing_provider", inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    },
    embed: async () => ({ embeddings: [], dimensions: 0, providerId: "failing_provider" }),
    healthCheck: async () => false,
    estimateTokens: () => 100,
  });

  const fallbackRes = await providerManager.generateWithFallback({ prompt: "Test fallback prompt" });
  assert(fallbackRes.usedFallback === true, "Automatic provider fallback executed when primary fails");
  assert(fallbackRes.result.providerId === "mock", "Fallback successfully routed to healthy MockProvider");

  // Test 4: Engine Pipeline Execution (EXPLAIN, SOLVE, QUIZ, FLASHCARDS, SUMMARY, PLAN)
  console.log(`\n[4/6] Testing AI Engine Pipeline Execution...`);
  const engine = new AIEngine();

  const testRequests = [
    { message: "اشرح لي مفهوم المتغيرات في البرمجة", expectedAction: "EXPLAIN" },
    { message: "حل المسألة التالية خطوة بخطوة 2x + 5 = 15", expectedAction: "SOLVE" },
    { message: "اعطني كويز وسؤال اختيارات عن المصفوفات", expectedAction: "QUIZ" },
    { message: "انشئ لي بطاقات استذكار فلاد كارد للمصلحات", expectedAction: "FLASHCARDS" },
    { message: "لخص لي الدرس الأول من المنهج", expectedAction: "SUMMARY" },
    { message: "صمم لي خطة دراسية وجدول دراسة", expectedAction: "PLAN" },
    { message: "شجعني وادعمني معنوياً للدراسة", expectedAction: "MOTIVATE" },
    { message: "اكتب تقرير ولي الأمر لشخص أداء الطالب", expectedAction: "PARENT_REPORT" },
  ];

  for (const req of testRequests) {
    const response = await engine.processRequest({
      userMessage: req.message,
      studentId: "test_std_123",
      subject: "برمجه عملي",
      grade: "sec_1",
    });

    assert(
      response.success === true,
      `Engine processed request '${req.message.slice(0, 25)}...' successfully`
    );
    assert(
      response.formattedResponse.renderedContent.length > 0,
      `Formatted response contains valid content for action '${response.action}'`
    );
  }

  // Test 5: Context Building & Compression
  console.log(`\n[5/6] Testing Context Building & Compression...`);
  const contextBuilder = new ContextBuilder();
  const fullCtx = contextBuilder.buildContext({ studentId: "std_456", grade: "prep_2" });
  assert(fullCtx.student.id === "std_456", "ContextBuilder builds strongly-typed AIContext");
  
  const compressedCtx = contextBuilder.compressContext(fullCtx);
  assert(compressedCtx.quizHistory.length <= 1, "Context compression compresses history within token budget");

  // Test 6: Telemetry Engine Recording
  console.log(`\n[6/6] Testing Telemetry Engine...`);
  const telemetry = Telemetry.getInstance();
  const metrics = telemetry.getMetrics();
  
  assert(metrics.totalRequests > 0, `Telemetry recorded total ${metrics.totalRequests} engine requests`);
  assert(metrics.successfulRequests > 0, `Telemetry tracked ${metrics.successfulRequests} successful executions`);
  assert(metrics.totalTokensUsed > 0, `Telemetry estimated total ${metrics.totalTokensUsed} tokens used`);

  console.log("\n=================================================");
  console.log(`   Verification Finished: ${testsPassed} Passed, ${testsFailed} Failed   `);
  console.log("=================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
