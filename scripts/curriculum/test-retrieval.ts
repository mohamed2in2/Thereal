/**
 * Retrieval acceptance tests for the official curriculum knowledge base.
 *
 *   npx tsx scripts/curriculum/test-retrieval.ts
 *
 * Each case asserts that a realistic student question retrieves content from
 * the lesson that actually teaches it.
 */

import { CurriculumRetriever } from "../../src/ai/knowledge/curriculum/CurriculumRetriever";
import { FileCurriculumStore } from "../../src/ai/knowledge/curriculum/FileCurriculumStore";
import { buildGrounding } from "../../src/ai/knowledge/curriculum/CurriculumGrounding";
import { CurriculumScope } from "../../src/ai/knowledge/curriculum/types";

interface Case {
  question: string;
  expectLesson: string;
  scope?: CurriculumScope;
  note?: string;
}

const CASES: Case[] = [
  { question: "ما هو قانون مور؟", expectLesson: "1-1" },
  { question: "اشرح مراحل تطور تكنولوجيا المعلومات", expectLesson: "1-1" },
  { question: "كيف يتعلم الذكاء الاصطناعي من البيانات؟", expectLesson: "1-2" },
  { question: "ما القضايا الأخلاقية المتعلقة بالذكاء الاصطناعي؟", expectLesson: "1-4" },
  { question: "ما الفرق بين التشفير المتماثل وغير المتماثل؟", expectLesson: "2-1" },
  { question: "ما هو جدار الحماية وكيف يحمي الشبكة؟", expectLesson: "2-2" },
  { question: "ما الطبقات الثلاث التي يتكوّن منها تطبيق الويب؟", expectLesson: "3-1" },
  {
    question: "اشرح نموذج العميل والخادم ودورة الطلب والاستجابة",
    expectLesson: "3-2",
    note: "the client/server model is taught in 3-2, not in 3-1",
  },
  { question: "ما الفرق بين GET و POST في HTTP؟", expectLesson: "3-2" },
  { question: "ما هي طرق جمع البيانات الأولية والثانوية؟", expectLesson: "5-1" },
  { question: "كيف أنظف البيانات من القيم المفقودة؟", expectLesson: "5-2" },
  { question: "ما هو تحليل الانحدار الخطي؟", expectLesson: "6-2" },
  { question: "اشرح الشبكات العصبية والتعلم العميق", expectLesson: "7-2" },
  { question: "ما هي نماذج اللغة الكبيرة؟", expectLesson: "7-3" },
];

async function main() {
  const store = FileCurriculumStore.getInstance();
  await store.ready();
  const retriever = CurriculumRetriever.getInstance();

  console.log(`Knowledge base: ${store.size()} chunks`);
  console.log(
    `Embeddings: ${store.hasVectors() ? `yes (${store.vectorModel}, ${store.dimensions}d)` : "no — lexical only"}`
  );
  console.log("");

  let passed = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const results = await retriever.retrieve({
      question: testCase.question,
      scope: testCase.scope,
      limit: 5,
    });
    const lessons = results.map((r) => r.chunk.lesson_number);
    const top = lessons[0] ?? "—";
    const hit = lessons.includes(testCase.expectLesson);
    const exact = top === testCase.expectLesson;

    if (hit) passed += 1;
    else failures.push(`${testCase.question} -> got [${lessons.join(", ")}], want ${testCase.expectLesson}`);

    const mark = exact ? "PASS" : hit ? "pass" : "FAIL";
    console.log(
      `[${mark}] want ${testCase.expectLesson.padEnd(4)} top ${String(top).padEnd(4)} | ${testCase.question}`
    );
    if (!hit) console.log(`         retrieved: ${lessons.join(", ")}`);
  }

  console.log("");
  console.log(`${passed}/${CASES.length} questions retrieved their lesson.`);

  // Scope preference: the same generic question should follow the student.
  console.log("\n--- scope biasing ---");
  for (const lesson of ["1-2", "7-2"]) {
    const results = await retriever.retrieve({
      question: "اشرح لي الفكرة الأساسية في هذا الدرس",
      scope: { lessonNumber: lesson },
      limit: 3,
    });
    const top = results[0]?.chunk.lesson_number ?? "—";
    console.log(`  scope ${lesson} -> top result from lesson ${top} ${top === lesson ? "OK" : "MISS"}`);
  }

  // Grounding must never leak internals.
  console.log("\n--- grounding safety ---");
  const sample = await retriever.retrieve({ question: "ما هو قانون مور؟", limit: 3 });
  const grounding = buildGrounding(sample);
  const leaked = ["cur_", "embedding", "vector", "chunk_id", "docIndex"].filter((token) =>
    grounding.promptBlock.toLowerCase().includes(token.toLowerCase())
  );
  console.log(`  citations: ${grounding.citations.join(" | ")}`);
  console.log(`  internal identifiers leaked: ${leaked.length ? leaked.join(", ") : "none"}`);

  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failures.length || leaked.length ? 1 : 0);
}

main();
