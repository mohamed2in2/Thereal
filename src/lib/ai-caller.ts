// =========================================================
// AI CALLER — Code-UP Platform (SERVER-SIDE ONLY)
// Unified REST gateway for Gemini; quota-aware routing.
// Usage: import only in /api routes or server components.
// =========================================================

import type { TaskType, ModelId } from "./quota-manager";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ── Key rotation: two projects share the daily quota burden ───────────────
// KEY_1 is used by default; if a 429 is hit, the next call tries KEY_2.
// The chosen key is tracked in a simple module-level variable (resets per cold start).
let _keyIndex = 0;
const _keys = [
  process.env.GEMINI_API_KEY_1 ?? process.env.GEMINI_API_KEY ?? process.env.AI_BACKUP_API_KEY ?? "",
  process.env.GEMINI_API_KEY_2 ?? process.env.GEMINI_API_KEY ?? process.env.AI_BACKUP_API_KEY ?? "",
].filter(Boolean);

function apiKey(): string {
  if (_keys.length === 0) throw new Error("No GEMINI_API_KEY configured");
  return _keys[_keyIndex % _keys.length];
}

function rotateKey() {
  if (_keys.length > 1) {
    _keyIndex = (_keyIndex + 1) % _keys.length;
    console.warn(`[AI] Rotating to key #${_keyIndex + 1}`);
  }
}

// REST-compatible model IDs (Live/Audio models fall back to flash-lite for REST)
const REST_FALLBACK: Partial<Record<ModelId, ModelId>> = {
  "gemini-2.0-flash-live-001":                    "gemini-2.0-flash-lite",
  "gemini-2.5-flash-preview-native-audio-dialog": "gemini-2.0-flash-lite",
  "gemini-2.0-flash-live-translate":               "gemini-2.0-flash-lite",
};

function toRestModel(model: ModelId): string {
  return REST_FALLBACK[model] ?? model;
}

// ── Core REST call ────────────────────────────────────────────────────────
export interface AICallOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  forceModel?: ModelId;
  task?: TaskType;
}

export interface AICallResult {
  text: string;
  model: string;
  tokensUsed: number;
}

export async function callAI(prompt: string, options: AICallOptions = {}): Promise<AICallResult> {
  const targetModel = options.forceModel ?? "gemini-2.0-flash-lite";
  const restModel   = toRestModel(targetModel);

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(options.systemPrompt && {
      system_instruction: { parts: [{ text: options.systemPrompt }] },
    }),
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 800,
      temperature:     options.temperature ?? 0.7,
    },
  };

  let res: Response;
  try {
    res = await fetch(
      `${GEMINI_BASE}/models/${restModel}:generateContent?key=${apiKey()}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch (networkErr) {
    throw new Error(`Network error calling Gemini: ${String(networkErr)}`);
  }

  if (!res.ok) {
    if (res.status === 429) {
      // Try rotating to the other API key first (same quota tier, different project)
      rotateKey();
      // If we've rotated and still get 429, wait 12s then fall back to flash-lite
      if (_keys.length > 1) {
        console.warn("[AI] Rate limited (429), rotating key and retrying...");
        await new Promise(r => setTimeout(r, 2_000));
        return callAI(prompt, options);
      }
      console.warn("[AI] Rate limited (429), retrying with flash-lite after 12s...");
      await new Promise(r => setTimeout(r, 12_000));
      return callAI(prompt, { ...options, forceModel: "gemini-2.0-flash-lite" });
    }
    const errBody = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data     = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { totalTokenCount?: number } };
  const text      = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;

  return { text, model: restModel, tokensUsed };
}

// ── Batch question generator (20 questions per call = 19× savings) ────────
export interface GeneratedQuestion {
  question: string;
  choices: string[];
  answer: string;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function generateQuestionBatch(
  subject: string,
  difficulty: "easy" | "medium" | "hard",
  count = 20,
): Promise<GeneratedQuestion[]> {
  const prompt = `
أنت معلم خبير. أنشئ بالضبط ${count} سؤال اختيار من متعدد للمادة: ${subject}
المستوى: ${difficulty}
اللغة: العربية الفصحى البسيطة

أعد فقط مصفوفة JSON صالحة بدون أي markdown أو شرح خارجي:
[
  {
    "question": "نص السؤال هنا",
    "choices": ["أ) الخيار الأول", "ب) الخيار الثاني", "ج) الخيار الثالث", "د) الخيار الرابع"],
    "answer": "أ) الخيار الصحيح",
    "hint": "تلميح قصير لا يكشف الإجابة مباشرة",
    "difficulty": "${difficulty}"
  }
]
`.trim();

  const { text } = await callAI(prompt, {
    forceModel: "gemini-2.0-flash-lite",
    maxTokens: 4_000,
    temperature: 0.85,
  });

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as GeneratedQuestion[];
  } catch {
    console.error("[AI] Failed to parse question batch:", text.slice(0, 300));
    return [];
  }
}

// ── IQ / game session report ──────────────────────────────────────────────
export interface IQReportInput {
  studentName: string;
  subject: string;
  subjectAr: string;
  correctAnswers: number;
  totalQuestions: number;
  avgTimeSec: number;
  maxLevel: number;
  maxStreak: number;
  difficulty: string;
  skills: Record<string, number>; // skill → IQ score
}

export async function generateIQReport(input: IQReportInput): Promise<string> {
  const pct = Math.round((input.correctAnswers / input.totalQuestions) * 100);
  const prompt = `
أنت مدرس ذكي ومشجع جداً. اكتب تغذية راجعة قصيرة (3-4 جمل بالعربية) لهذا الطالب بعد انتهاء جلسة اللعبة:

الاسم: ${input.studentName}
المادة: ${input.subjectAr}
الإجابات الصحيحة: ${input.correctAnswers}/${input.totalQuestions} (${pct}%)
أعلى مستوى وصل إليه: ${input.maxLevel}/10
أعلى streak: ${input.maxStreak}
متوسط وقت الإجابة: ${input.avgTimeSec.toFixed(1)} ثانية
مستوى الصعوبة: ${input.difficulty}

اذكر:
1. جملة مشجعة مخصصة لأدائه
2. نقطة قوة واحدة ملحوظة
3. توصية عملية واحدة للتحسين

لا تذكر أرقاماً كثيرة — ركّز على التشجيع والتوجيه. أجب باختصار.
`.trim();

  // Use 2.5 Flash for quality reports if quota allows; else lite
  const model: ModelId = "gemini-2.0-flash-lite"; // reliable, 500 RPD
  const { text } = await callAI(prompt, { forceModel: model, maxTokens: 250, temperature: 0.75 });
  return text.trim();
}

// ── Study plan generator (used by /api/ai/study-plan) ────────────────────
export interface StudyTask {
  type: "video" | "quiz" | "practice" | "review";
  title: string;
  duration: number; // minutes
  subject?: string;
  priority: "high" | "medium" | "low";
}

export async function generateStudyPlanAI(params: {
  studentName: string;
  stage: string;
  weaknesses: { subject: string; avgScore: number }[];
  enrolledCourses: string[];
  iqScores: Record<string, number>;
}): Promise<StudyTask[]> {
  const weakStr = params.weaknesses.map(w => `${w.subject} (${w.avgScore}%)`).join("، ") || "لا توجد ضعف محدد";

  const prompt = `
أنشئ خطة دراسة يومية للطالب "${params.studentName}" (${params.stage}).
نقاط الضعف: ${weakStr}
الكورسات المسجلة: ${params.enrolledCourses.join("، ")}
IQ Scores: ${JSON.stringify(params.iqScores)}

أعد فقط مصفوفة JSON (4-6 مهام، مجموع لا يتجاوز 90 دقيقة):
[
  { "type": "video|quiz|practice|review", "title": "عنوان المهمة", "duration": 20, "subject": "الرياضيات", "priority": "high|medium|low" }
]
`.trim();

  const { text } = await callAI(prompt, { forceModel: "gemini-2.0-flash-lite", maxTokens: 600, temperature: 0.7 });

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as StudyTask[];
  } catch {
    // Static fallback
    return [
      { type: "video",    title: "مراجعة درس اليوم",      duration: 20, subject: "عام",         priority: "high" },
      { type: "quiz",     title: "اختبار سريع",            duration: 15, subject: "عام",         priority: "high" },
      { type: "practice", title: "تمارين تفاعلية",         duration: 25, subject: "رياضيات",     priority: "medium" },
      { type: "review",   title: "مراجعة الأخطاء السابقة", duration: 20, subject: "عام",         priority: "low" },
    ];
  }
}
