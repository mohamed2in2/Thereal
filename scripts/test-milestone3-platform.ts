import {
  AIEngine,
  AIGateway,
  CitationFormatter,
  DefaultMultimodalAdapter,
  DecisionExplainer,
  DocumentLoader,
  EducationalEventBus,
  EducationalWorkflows,
  EventSubscribers,
  LayeredMemory,
  LearningGraph,
  PathNavigator,
  PermissionManager,
  PlatformContextInjector,
  RecommendationEngine,
  RetrievalIndex,
  StudentStateMachine,
  TaskModelRouter,
  TeachingStrategyAdapter,
  TextChunker,
  ToolCache,
  ToolChainer,
  ToolObservability,
  ToolRegistry,
  registerAllTools,
} from "../src/ai";

async function runMilestone3Verification() {
  console.log("=========================================================================");
  console.log("   Code-UP AI Engine - Milestone 3 Platform Integration Verification     ");
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

  // 1. AI Gateway Subsystem
  console.log(`[1/11] Testing AI Gateway Subsystem...`);
  const gateway = new AIGateway();
  const gatewayResult = await gateway.executeRequest("std_gtw_1", "SOLVE", { prompt: "Solve 2x + 5 = 15" });
  assert(gatewayResult.result.text.length > 0, "AI Gateway executed request through provider manager");
  assert(gatewayResult.modelTier === "strong", "TaskModelRouter routed SOLVE to 'strong' model tier");
  assert(gatewayResult.costEstimateUsd > 0, "Gateway calculated cost estimate in USD");

  // 2. Universal Tool Calling Framework & Categories
  console.log(`\n[2/11] Testing Universal Tool Calling Framework...`);
  registerAllTools();
  const toolRegistry = ToolRegistry.getInstance();
  const allTools = toolRegistry.getAllTools();
  assert(allTools.length >= 10, `ToolRegistry contains registered platform tools (Count: ${allTools.length})`);

  const studentTool = toolRegistry.getTool("GetStudentProfile");
  assert(studentTool !== undefined, "ToolRegistry retrieved 'GetStudentProfile' tool");

  // RBAC Permission Check
  if (studentTool) {
    assert(PermissionManager.isAllowed(studentTool, "student") === true, "PermissionManager allowed 'student' role for GetStudentProfile");
    let permDenied: boolean = false;
    try {
      PermissionManager.checkPermission(studentTool, "anonymous");
    } catch {
      permDenied = true;
    }
    assert(permDenied === true, "PermissionManager blocked unauthorized role ('anonymous')");
  }

  // Tool Chainer Execution & Caching
  const chainer = new ToolChainer();
  const chainResults = await chainer.executeChain(
    { userId: "std_chain_1", userRole: "student" },
    [{ toolName: "GetStudentProfile" }, { toolName: "GetCurrentCourse" }]
  );
  assert(chainResults.length === 2 && chainResults[0].success, "ToolChainer executed sequential tool chain");

  // Cache hit test
  const cachedResults = await chainer.executeChain(
    { userId: "std_chain_1", userRole: "student" },
    [{ toolName: "GetStudentProfile" }]
  );
  assert(cachedResults[0].fromCache === true, "ToolCache returned cached result on duplicate tool call");

  // Tool Observability Logging
  const obsLogs = ToolObservability.getInstance().getLogs();
  assert(obsLogs.length > 0, "ToolObservability logged tool execution telemetry");

  // 3. Educational State Machine
  console.log(`\n[3/11] Testing Educational State Machine...`);
  const stateMachine = new StudentStateMachine("WATCHING_LESSON");
  assert(stateMachine.getState() === "WATCHING_LESSON", "State Machine initialized at WATCHING_LESSON");

  stateMachine.transition("FINISH_LESSON");
  assert(stateMachine.getState() === "TAKING_QUIZ", "Automatic transition: WATCHING_LESSON -> TAKING_QUIZ");

  stateMachine.transition("FAIL_QUIZ");
  assert(stateMachine.getState() === "FAILED_ONCE", "Automatic transition: TAKING_QUIZ -> FAILED_ONCE");

  stateMachine.transition("FAIL_QUIZ");
  assert(stateMachine.getState() === "FAILED_MULTIPLE", "Automatic transition: FAILED_ONCE -> FAILED_MULTIPLE");

  const strategy = TeachingStrategyAdapter.getStrategyInstructions("FAILED_MULTIPLE");
  assert(strategy.includes("مراجعة مكثفة"), "TeachingStrategyAdapter adapted prompt strategy for FAILED_MULTIPLE state");

  // 4. Learning Graph Architecture
  console.log(`\n[4/11] Testing Directed Curriculum Learning Graph...`);
  const graph = new LearningGraph();
  const prereqCheck = graph.checkPrerequisites("lsn_103", ["lsn_101"]);
  assert(prereqCheck.satisfied === false && prereqCheck.missingPrerequisites.includes("lsn_102"), "Prerequisite check identified missing prerequisite 'lsn_102'");

  const navigator = new PathNavigator(graph);
  const nextLesson = navigator.getNextOptimalLesson("lsn_101", ["lsn_101"]);
  assert(nextLesson?.id === "lsn_102", "PathNavigator dynamically recommended next optimal lesson ('lsn_102')");

  // 5. RAG Infrastructure
  console.log(`\n[5/11] Testing RAG Infrastructure...`);
  const doc = DocumentLoader.createDocument("lesson_content", "الفيزياء الحديثة", "قانون أوم يربط الجهد بالتيار والمقاومة");
  const chunks = TextChunker.chunkDocument(doc.id, doc.content, 10, 2);
  assert(chunks.length > 0, "TextChunker created semantic document chunks");

  const ragIndex = RetrievalIndex.getInstance();
  ragIndex.indexDocument(doc, chunks);
  const hits = ragIndex.search("أوم الجهد");
  assert(hits.length > 0 && hits[0].relevanceScore > 0, "RetrievalIndex searched and ranked matching chunks");

  const citations = CitationFormatter.formatCitations(hits);
  assert(citations.includes("المصادر الأكاديمية") || citations.includes("الفيزياء الحديثة"), "CitationFormatter rendered markdown source citation tags");

  // 6. Educational Event Bus
  console.log(`\n[6/11] Testing Educational Event Bus...`);
  EventSubscribers.registerDefaultSubscribers();
  const bus = EducationalEventBus.getInstance();
  let eventReceived: boolean = false;
  bus.subscribe("QuizFailed", async () => { eventReceived = true; });

  await bus.publish("QuizFailed", { studentId: "std_event_1", score: 40, timestamp: new Date() });
  assert(Boolean(eventReceived), "EducationalEventBus triggered subscriber callback on QuizFailed event");

  // 7. Recommendation Engine
  console.log(`\n[7/11] Testing Proactive Recommendation Engine...`);
  const recs = RecommendationEngine.generateRecommendations("std_rec_1", 100, ["المتغيرات"], 50);
  assert(recs.length > 0, "RecommendationEngine generated proactive learning recommendations");

  // 8. Multi-Step Workflow Engine
  console.log(`\n[8/11] Testing Multi-Step Workflow Engine...`);
  const workflowRes = await EducationalWorkflows.runStudyPlanGeneration("std_wf_1");
  assert(workflowRes.success === true && workflowRes.executedSteps.length === 7, "WorkflowEngine executed 7-step StudyPlanGeneration workflow");

  // 9. Multi-Layer Memory Architecture
  console.log(`\n[9/11] Testing Multi-Layer Memory Architecture...`);
  const memory = LayeredMemory.getInstance();
  memory.addSessionTurn("sess_1", "user", "مرحباً كود اب");
  const sessionHist = memory.getSessionHistory("sess_1");
  assert(sessionHist.length === 1, "LayeredMemory stored Session Memory turn");

  const profile = memory.getLongTermProfile("std_mem_1");
  assert(profile.studentId === "std_mem_1", "LayeredMemory retrieved Long-Term Learning Profile");

  // 10. Decision Explainability
  console.log(`\n[10/11] Testing Decision Explainability...`);
  const explanation = DecisionExplainer.createExplanation("EXPLAIN", ["GetLesson"], 0.95, ["برمجة"], "Intermediate", "WATCHING_LESSON");
  assert(explanation.selectedAction === "EXPLAIN" && explanation.explanationSummary.length > 0, "DecisionExplainer created internal reasoning metadata");

  // 11. Multimodal Extension Points & AIEngine Integration
  console.log(`\n[11/11] Testing Multimodal Extension Points & Master AIEngine Integration...`);
  const multimodal = new DefaultMultimodalAdapter();
  const ocrRes = await multimodal.extractTextFromImage({ imageUrl: "https://example.com/hw.png" });
  assert(ocrRes.confidence === 0.95, "Multimodal Extension Point executed simulated OCR extraction");

  const engine = new AIEngine();
  const engineResponse = await engine.processRequest({
    userMessage: "اشرح لي المتغيرات في البرمجة",
    studentId: "std_m3_test",
    subject: "برمجه عملي",
  });

  assert(engineResponse.success === true, "Master AIEngine executed request cleanly");
  assert(engineResponse.decisionMetadata !== undefined, "AIEngine response attached decision reasoning metadata");
  assert(engineResponse.educationalState !== undefined, "AIEngine response attached current student educational state");

  console.log("\n=========================================================================");
  console.log(`   Verification Finished: ${testsPassed} Passed, ${testsFailed} Failed   `);
  console.log("=========================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runMilestone3Verification().catch((err) => {
  console.error("Milestone 3 verification script error:", err);
  process.exit(1);
});
