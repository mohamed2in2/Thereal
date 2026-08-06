import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const PRIMARY_API_KEY = process.env.AI_PRIMARY_API_KEY || "";
const PRIMARY_API_URL = process.env.AI_PRIMARY_BASE_URL || "https://api.anthropic.com/v1/messages";
const PRIMARY_MODEL = process.env.AI_PRIMARY_MODEL || "claude-3-5-sonnet-20241022";

const BACKUP_API_KEY = process.env.AI_BACKUP_API_KEY || process.env.GEMINI_API_KEY || "";
const BACKUP_BASE_RAW = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const BACKUP_BASE_URL = BACKUP_BASE_RAW.replace(/\/+$/, "");
const BACKUP_MODEL = process.env.AI_BACKUP_MODEL || "gemini-2.0-flash-lite";

async function callPrimary(messages: { role: string; content: string }[]) {
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role !== "system");
  const res = await fetch(PRIMARY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PRIMARY_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      max_tokens: 1200,
      system: sys,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Primary AI error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callBackup(messages: { role: string; content: string }[]) {
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const geminiBase = BACKUP_BASE_URL.endsWith("/models") ? BACKUP_BASE_URL : `${BACKUP_BASE_URL}/models`;
  const url = `${geminiBase}/${BACKUP_MODEL}:generateContent?key=${BACKUP_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Backup AI error: ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
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

  let reply: string;

  // Try primary API (Claude), fallback to Gemini, then static fallback
  try {
    if (PRIMARY_API_KEY) {
      reply = await callPrimary(formattedMessages);
    } else {
      throw new Error("No primary AI key");
    }
  } catch {
    try {
      if (BACKUP_API_KEY) {
        reply = await callBackup(formattedMessages);
      } else {
        throw new Error("No backup AI key");
      }
    } catch {
      reply = generateFallbackPlan(courses || []);
    }
  }

  return NextResponse.json({ reply });
}
