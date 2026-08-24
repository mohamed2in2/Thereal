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

async function callGeminiFallback(messages: { role: string; content: string }[]): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) return null;
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const geminiBase = BACKUP_BASE_URL.endsWith("/models") ? BACKUP_BASE_URL : `${BACKUP_BASE_URL}/models`;
  const models = Array.from(new Set([BACKUP_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-pro"]));

  for (const key of GEMINI_KEYS) {
    for (const model of models) {
      try {
        const url = `${geminiBase}/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch {
        continue;
      }
    }
  }
  return null;
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

  const reply =
    (await callGeminiFallback(formattedMessages)) ||
    "مساعد الذكاء الاصطناعي قيد التحديث والصيانة حالياً، يرجى المحاولة مرة أخرى لاحقاً ⏳";

  return NextResponse.json({ reply });
}
