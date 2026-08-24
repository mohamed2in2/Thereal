import { prisma } from "./prisma";

// XKiro (DeepSeek v4 Flash)
const XKIRO_API_KEY = process.env.XKIRO_API_KEY || "";
const XKIRO_BASE_URL = (process.env.XKIRO_BASE_URL || "https://api.xkiro.com/v1").replace(/\/+$/, "");
const XKIRO_MODEL = process.env.XKIRO_MODEL || "deepseek/deepseek-v4-flash";

// Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "allam-2-7b";

// Gemini fallback
const GEMINI_KEY = process.env.GEMINI_KEY_1 || process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

export interface LectureMetadata {
  videoId: string;
  title: string;
  courseTitle?: string;
  subject?: string;
  educationalStage?: string;
  folderName?: string;
  durationMinutes?: number;
  questions?: Array<{ question: string; correctAnswer?: string }>;
}

const SUMMARY_SYSTEM_PROMPT = `أنت مساعد تعليمي وخبير تلخيص المناهج والمحاضرات على منصة Code-UP.
مهمتك: كتابة ملخص تعليمي مركز واحترافي وشامل للدرس المحدد، ليكون بمثابة مذكرة مراجعة ليلة الامتحان للطالب.

قواعد التلخيص:
1. استخدم لغة عربية مصرية تعليمية واضحة ومبسطة.
2. نسق الملخص بتنسيق Markdown مع العناوين والرموز التعبيرية والنقاط المنظمة.
3. قسّم الملخص إلى 4 أقسام رئيسية محددة:
   - 📌 **أهم المفاهيم والنقاط الجوهرية (Core Concepts)**: شرح مركز ومبسط لموضوع الدرس.
   - 📐 **القوانين والمعادلات أو القواعد الأساسية (Key Rules & Formulas)**: إذا كان الدرس علمي/رياضي/برمجي اذكر القوانين والأكواد، وإن كان لغوياً/نظرياً اذكر القواعد الهامة.
   - ⚠️ **تكات الامتحان والأخطاء الشائعة (Exam Traps & Pro Tips)**: مواضع الأسئلة الصعبة التي يخطئ فيها الطلاب عادة في امتحانات الثانوية والمراحل التعليمية.
   - 💡 **سؤال وجواب للمراجعة السريعة (Quick Q&A)**: 3 إلى 5 أسئلة نموذجية مع إجاباتها النموذجية المختصرة.
4. تجنب الحشو والإطالة غير المفيدة، وركز على الفائدة المباشرة للدرجات والفهم.`;

// In-memory cache for fast instant delivery of generated summaries
const summaryCache = new Map<string, { summary: string; generatedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function generateLectureSummary(lecture: LectureMetadata, forceRefresh = false): Promise<string> {
  const cacheKey = `summary:${lecture.videoId}`;
  if (!forceRefresh) {
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
      return cached.summary;
    }
  }

  const questionsContext = lecture.questions && lecture.questions.length > 0
    ? lecture.questions.map((q, idx) => `س${idx + 1}: ${q.question} (الإجابة: ${q.correctAnswer || "غير محددة"})`).join("\n")
    : "لا توجد أسئلة مسجلة مسبقاً.";

  const userPrompt = `يرجى إعداد ملخص ومذكرة مراجعة شاملة ومتقنة لهذه المحاضرة:
- 📖 عنوان الدرس: ${lecture.title}
- 📚 الكورس: ${lecture.courseTitle || "عام"}
- 🏷️ المادة/الموضوع: ${lecture.subject || "تعليمي"}
- 🎓 المرحلة الدراسية: ${lecture.educationalStage || "المرحلة الثانوية"}
- 📁 المجلد/الوحدة: ${lecture.folderName || "الوحدة الأولى"}
- ⏱️ مدة الفيديو: ${lecture.durationMinutes || 30} دقيقة

الأسئلة والتمارين المرتبطة بالدرس:
${questionsContext}

اكتب الملخص الشامل بتنسيق Markdown بالأقسام الأربعة المطلوبة.`;

  // Exclusively try Google Gemini
  if (GEMINI_KEY) {
    try {
      const endpoint = `${GEMINI_BASE}/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUMMARY_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 100) {
          summaryCache.set(cacheKey, { summary: text, generatedAt: Date.now() });
          return text;
        }
      }
    } catch (e) {
      console.warn("[AI Lecture Summary] Gemini call failed:", e);
    }
  }

  // 4. Fallback structured template
  const fallbackSummary = `### 📌 ملخص درس: ${lecture.title}

#### 1. المفاهيم والنقاط الجوهرية
- يركز هذا الدرس على الفهم التطبيقي لموضوع **${lecture.title}** ضمن منهج **${lecture.courseTitle || "الكورس"}**.
- يوصى بمشاهدة الفيديو بالكامل وحل التمارين التفاعلية المرفقة لترسيخ المعلومات.

#### 2. أهم القوانين والملاحظات
- راجع القواعد الأساسية والمعادلات الموضحة في الشرح بدقة.
- تأكد من تدوين الملاحظات الهامة في كشكول المذاكرة الخاص بك.

#### ⚠️ 3. تكات الامتحان والأخطاء الشائعة
- الانتباه الشديد لصياغة الأسئلة غير المباشرة.
- مراجعة إجابات التمارين بعد نهاية الفيديو مباشرة لتجنب تكرار الأخطاء.

#### 💡 4. أسئلة المراجعة السريعة
${questionsContext}
`;

  summaryCache.set(cacheKey, { summary: fallbackSummary, generatedAt: Date.now() });
  return fallbackSummary;
}
