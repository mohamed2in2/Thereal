/**
 * Verifies the retrieved curriculum actually reaches the model's prompt.
 *
 *   npx tsx scripts/curriculum/test-prompt-integration.ts
 */

import { ContextBuilder } from "../../src/ai/context/ContextBuilder";
import { PromptBuilder } from "../../src/ai/prompts/PromptBuilder";
import { CurriculumRetriever } from "../../src/ai/knowledge/curriculum/CurriculumRetriever";
import { buildGrounding } from "../../src/ai/knowledge/curriculum/CurriculumGrounding";

async function main() {
  const question = "ما هو قانون مور وكيف أثر في تطور الحواسيب؟";

  const results = await CurriculumRetriever.getInstance().retrieve({
    question,
    scope: { lessonNumber: "1-1" },
    limit: 4,
  });
  const grounding = buildGrounding(results);

  const context = new ContextBuilder().buildContext({
    subject: "برمجه عملي",
    grade: "الصف الثاني الثانوي",
  });

  const prompt = new PromptBuilder().buildPrompt({
    userMessage: question,
    context,
    actionInstructions: "اشرح للطالب بأسلوب مبسط.",
    subjectRules: "قواعد المادة.",
    curriculumGrounding: grounding.promptBlock,
  });

  const checks: Array<[string, boolean]> = [
    ["retrieved at least one official chunk", results.length > 0],
    ["grounding marked as official", grounding.usedOfficialCurriculum],
    ["prompt contains the official-curriculum section", prompt.fullPrompt.includes("=== المنهج الرسمي")],
    ["prompt contains grounding rules", prompt.fullPrompt.includes("=== قواعد الاستناد إلى المنهج ===")],
    ["prompt quotes real curriculum text", prompt.fullPrompt.includes("قانون مور")],
    ["curriculum appears before the student message", prompt.fullPrompt.indexOf("=== المنهج الرسمي") < prompt.fullPrompt.indexOf("=== STUDENT MESSAGE")],
    ["no internal chunk ids in prompt", !/cur_[0-9a-f]{16}/.test(prompt.fullPrompt)],
    ["citations are student-safe", grounding.citations.every((c) => c.includes("الدرس") && !c.includes("cur_"))],
    ["source transparency present", prompt.fullPrompt.includes("الموضع:")],
  ];

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
    if (!ok) failed += 1;
  }

  console.log(`\nprompt length: ${prompt.fullPrompt.length} chars`);
  console.log(`citations: ${grounding.citations.join(" | ")}`);
  console.log(`\n--- grounding block (first 700 chars) ---\n${grounding.promptBlock.slice(0, 700)}`);

  process.exit(failed ? 1 : 0);
}

main();
