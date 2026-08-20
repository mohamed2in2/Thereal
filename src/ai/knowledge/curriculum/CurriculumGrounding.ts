/**
 * Turns retrieved curriculum chunks into a grounding block for the prompt.
 *
 * Two rules drive the shape of this text:
 *  - the model must be able to tell official curriculum content apart from its
 *    own added explanation, and must never blur the two;
 *  - the student may see where something came from (chapter, lesson, page) but
 *    never internal identifiers.
 */

import { QUESTION_CONTENT_TYPES, RetrievedChunk } from "./types";

const CONTENT_TYPE_AR: Record<string, string> = {
  learning_objectives: "أهداف التعلم",
  lesson_map: "خريطة الدرس",
  main_idea: "الفكرة الأساسية",
  key_concepts: "المفاهيم الأساسية",
  learning_path: "مسار التعلم",
  terminology: "مصطلحات أساسية",
  explanation: "شرح",
  important_note: "ملحوظة مهمة",
  solved_example: "مثال محلول",
  solution: "الحل",
  activity: "نشاط",
  practice: "تدريب",
  exercises: "تمارين",
  application: "تطبيق ما تعلمته",
  exam_style_question: "سؤال على نمط الامتحان",
  key_question: "السؤال الرئيسي",
  key_question_answer: "إجابة السؤال الرئيسي",
  reflection: "توقف وفكر",
  challenge: "تحدَّ نفسك",
  engineering_task: "فكر كمهندس",
  review: "مراجعة",
  summary: "الخلاصة",
};

export interface GroundingResult {
  /** Prompt section to inject, or empty when nothing relevant was found. */
  promptBlock: string;
  /** Human-readable citations, safe to show a student. */
  citations: string[];
  usedOfficialCurriculum: boolean;
  containsQuestions: boolean;
}

function describe(result: RetrievedChunk, index: number): string {
  const { chunk } = result;
  const kind = CONTENT_TYPE_AR[chunk.content_type] || "محتوى";
  const location = [
    `الفصل ${chunk.chapter_number}${chunk.chapter_title ? `: ${chunk.chapter_title}` : ""}`,
    `الدرس ${chunk.lesson_number}${chunk.lesson_title ? `: ${chunk.lesson_title}` : ""}`,
    chunk.section_title ? `القسم: ${chunk.section_title}` : null,
    chunk.book_page_start === chunk.book_page_end
      ? `صفحة ${chunk.book_page_start}`
      : `صفحات ${chunk.book_page_start}-${chunk.book_page_end}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `--- مقتطف ${index + 1} [${kind}] ---`,
    `الموضع: ${location}`,
    `النص الرسمي:`,
    chunk.text,
  ].join("\n");
}

export function citationFor(result: RetrievedChunk): string {
  const { chunk } = result;
  const page =
    chunk.book_page_start === chunk.book_page_end
      ? `ص ${chunk.book_page_start}`
      : `ص ${chunk.book_page_start}-${chunk.book_page_end}`;
  return `الدرس ${chunk.lesson_number}${chunk.lesson_title ? ` (${chunk.lesson_title})` : ""} · ${page}`;
}

export function buildGrounding(results: RetrievedChunk[]): GroundingResult {
  if (!results.length) {
    return {
      promptBlock: "",
      citations: [],
      usedOfficialCurriculum: false,
      containsQuestions: false,
    };
  }

  const containsQuestions = results.some((r) =>
    QUESTION_CONTENT_TYPES.has(r.chunk.content_type)
  );
  const first = results[0].chunk;

  const rules = [
    "اعتمد على المقتطفات الرسمية أعلاه كمصدر أساسي للإجابة.",
    "إذا أضفت شرحًا أو مثالًا من عندك لتبسيط الفكرة، فوضّح أنه شرح إضافي وليس نصًا من الكتاب.",
    "لا تنسب أي معلومة إلى المنهج الرسمي إن لم تكن موجودة في المقتطفات أعلاه.",
    "إذا لم تكفِ المقتطفات للإجابة، قل ذلك بوضوح ثم قدّم شرحًا تعليميًا إضافيًا موسومًا بأنه خارج نص الكتاب.",
    "يمكنك ذكر موضع المعلومة (الفصل والدرس والصفحة) عند الحاجة.",
    "لا تذكر أي معرفات داخلية أو تفاصيل تقنية عن طريقة البحث أو التخزين.",
  ];

  if (containsQuestions) {
    rules.push(
      "بعض المقتطفات أسئلة أو تمارين رسمية: اشرحها ووجّه الطالب خطوة بخطوة نحو الحل بدلًا من إعطاء الإجابة مباشرة.",
      "إذا ولّدت أسئلة تدريب إضافية، فاذكر صراحة أنها أسئلة تدريبية من إعدادك وليست من الكتاب الرسمي."
    );
  }

  const promptBlock = [
    "=== المنهج الرسمي (مصدر موثوق) ===",
    `المادة: ${first.subject_ar} · الصف: ${first.grade_ar} · المنهج: ${first.curriculum_ar} · الفصل الدراسي: ${first.term}`,
    "",
    results.map(describe).join("\n\n"),
    "",
    "=== قواعد الاستناد إلى المنهج ===",
    ...rules.map((rule) => `- ${rule}`),
  ].join("\n");

  return {
    promptBlock,
    citations: results.map(citationFor),
    usedOfficialCurriculum: true,
    containsQuestions,
  };
}
