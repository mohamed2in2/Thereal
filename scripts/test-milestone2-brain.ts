import {
  AIEngine,
  AdaptiveDifficulty,
  ErrorAnalyzer,
  HomeworkMode,
  LayeredTeacher,
  StudentObservationEngine,
  SubjectRulesRegistry,
} from "../src/ai";

async function runMilestone2Verification() {
  console.log("=================================================================");
  console.log("   Code-UP AI Engine - Milestone 2 Tutoring Brain Verification   ");
  console.log("=================================================================\n");

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

  // Test 1: Subject Rules Registry (9 Subjects)
  console.log(`[1/6] Testing Subject-Specific Pedagogical Rules...`);
  const registry = SubjectRulesRegistry.getInstance();
  const subjectsToTest = [
    "رياضيات",
    "فيزياء",
    "كيمياء",
    "أحياء",
    "لغة عربية",
    "لغة إنجليزية",
    "تاريخ",
    "جغرافيا",
    "برمجه عملي",
  ];

  for (const sub of subjectsToTest) {
    const rules = registry.getRule(sub);
    assert(
      rules.subject === sub,
      `Subject rule retrieved for '${sub}'`
    );
    assert(
      rules.instructions.length > 0,
      `Subject '${sub}' contains pedagogical instructions`
    );
  }

  // Test 2: Adaptive Difficulty Estimation
  console.log(`\n[2/6] Testing Adaptive Difficulty Levels...`);
  const begLevel = AdaptiveDifficulty.estimateLevel([], "prep_1", "أنا مبتدئ تماماً في البرمجة وشرح من الصفر");
  assert(begLevel === "Beginner", "Estimated Beginner level from text heuristic");

  const advLevel = AdaptiveDifficulty.estimateLevel([{ quizId: "q1", score: 95, date: "2026-07-22" }], "sec_3");
  assert(advLevel === "Advanced", "Estimated Advanced level from quiz history score (95%)");

  const defLevel = AdaptiveDifficulty.estimateLevel([]);
  assert(defLevel === "Intermediate", "Unknown level defaults to Intermediate");

  // Test 3: Layered Teacher Framework
  console.log(`\n[3/6] Testing 5-Layer Explanation Framework...`);
  const layeredInstructions = LayeredTeacher.getPromptInstructions();
  assert(
    layeredInstructions.includes("Layer 1") && layeredInstructions.includes("Layer 5"),
    "Layered teacher prompt instructions include 5-layer framework"
  );

  // Test 4: Homework Mode Progressive Hints
  console.log(`\n[4/6] Testing Homework Mode Progressive Hints...`);
  const hint1 = HomeworkMode.getInstructions(1, false);
  const hint2 = HomeworkMode.getInstructions(2, false);
  const sol = HomeworkMode.getInstructions(1, true);

  assert(hint1.includes("التلميح الأول") && hint1.includes("لا تكشف الإجابة"), "Hint 1 prevents answer disclosure");
  assert(hint2.includes("التلميح الثاني"), "Hint 2 provides additional guidance");
  assert(sol.includes("الحل الكامل"), "Solution disclosure provided when requested");

  // Test 5: Error Analyzer & Twin Question Generation
  console.log(`\n[5/6] Testing Error Analyzer...`);
  const errorText = ErrorAnalyzer.formatAnalysis({
    exactMistake: "نسيان كلمة let عند تعريف المتغير",
    rootCause: "عدم الإلمام بصياغة المتغيرات في JavaScript",
    correctReasoning: "يجب تحديد نوع المتغير بـ let أو const قبل الاسم",
    twinQuestion: "عرف متغيراً باسم score وقيمته 100",
  });
  assert(errorText.includes("تحليل الخطأ") && errorText.includes("سؤال تدريب مماثل"), "Error analyzer formats diagnosis and twin practice question");

  // Test 6: AI Engine Pipeline with Continuous Learning Observation
  console.log(`\n[6/6] Testing AI Engine with Continuous Learning Observation...`);
  const engine = new AIEngine();

  const response = await engine.processRequest({
    userMessage: "اشرح لي قانون أوم في الفيزياء وكيف أحسب المقاومة الكهربائية",
    subject: "فيزياء",
    grade: "sec_3",
  });

  assert(response.success === true, "Engine processed physics request successfully");
  assert(response.observation !== undefined, "Engine returned Continuous Learning Observation");
  assert(response.observation?.estimatedStudentLevel !== undefined, "Observation contains student level");
  assert(typeof response.observation?.estimatedUnderstanding === "number", "Observation contains estimated understanding score");

  console.log("\n=================================================================");
  console.log(`   Verification Finished: ${testsPassed} Passed, ${testsFailed} Failed   `);
  console.log("=================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runMilestone2Verification().catch((err) => {
  console.error("Milestone 2 verification script error:", err);
  process.exit(1);
});
