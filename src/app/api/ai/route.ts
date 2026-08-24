import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const XKIRO_API_KEY = process.env.XKIRO_API_KEY || "";
const XKIRO_BASE_URL = (process.env.XKIRO_BASE_URL || "https://api.xkiro.com/v1").replace(/\/+$/, "");
const XKIRO_MODEL = process.env.XKIRO_MODEL || "deepseek/deepseek-v4-flash";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "allam-2-7b";

// Gemini fallback keys (rotation)
const GEMINI_KEYS = [
  process.env.GEMINI_KEY_1 || process.env.GEMINI_API_KEY || "",
  process.env.GEMINI_KEY_2 || process.env.GEMINI_API_KEY_SECONDARY || "",
  process.env.GEMINI_KEY_3 || "",
].filter(Boolean);
const BACKUP_BASE_RAW = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const BACKUP_BASE_URL = BACKUP_BASE_RAW.replace(/\/+$/, "");
const BACKUP_MODEL = process.env.AI_BACKUP_MODEL || "gemini-flash-lite-latest";

async function callXKiro(messages: { role: string; content: string }[]): Promise<string | null> {
  if (!XKIRO_API_KEY) return null;
  try {
    const res = await fetch(`${XKIRO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XKIRO_API_KEY}`,
      },
      body: JSON.stringify({
        model: XKIRO_MODEL,
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

async function callGroq(messages: { role: string; content: string }[]): Promise<string | null> {
  if (!GROQ_API_KEY) return null;
  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

async function callGeminiFallback(messages: { role: string; content: string }[]): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) return null;
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const geminiBase = BACKUP_BASE_URL.endsWith("/models") ? BACKUP_BASE_URL : `${BACKUP_BASE_URL}/models`;
  for (const key of GEMINI_KEYS) {
    try {
      const url = `${geminiBase}/${BACKUP_MODEL}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      continue;
    }
  }
  return null;
}

function generateFallbackPlan(courses: string[]): string {
  const today = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `## خطة التعلم اليومية - ${today}

مرحباً! إليك خطة تدريبية مقترحة بناءً على كورساتك:

${courses.length > 0 ? courses.map((c, i) => `**${i + 1}. ${c}**
- مراجعة المحاضرات السابقة: 30 دقيقة
- تعلم محتوى جديد: 45 دقيقة  
- حل التمارين والاختبارات: 15 دقيقة`).join("\n\n") : "لم تنضم إلى أي كورس بعد. ابدأ بتسجيل كود الوصول في صفحة الكورسات."}

**نصائح للتعلم الفعالة:**
- خذ استراحة 10 دقائق كل ساعة
- راجع الملاحظات قبل النوم
- حل الاختبارات لتعزيز الفهم`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { messages, courses } = await req.json();

  const systemPrompt = `أنت مساعد تدريبي ذكي لمنصة كورسات مصرية. مهمتك مساعدة المتعلمين في وضع خطط تدريبية يومية.
الكورسات المسجل فيها المتعلم: ${courses?.join(", ") || "لا يوجد كورسات"}
أجب باللغة العربية دائماً. كن مفيداً وداعماً.`;

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...(messages || []),
  ];

  // Try XKiro (DeepSeek v4 Flash) first, then Gemini key rotation, then Groq, then static fallback
  const reply =
    (await callXKiro(formattedMessages)) ||
    (await callGeminiFallback(formattedMessages)) ||
    (await callGroq(formattedMessages)) ||
    generateFallbackPlan(courses || []);

  return NextResponse.json({ reply });
}
