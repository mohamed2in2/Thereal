import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const GEMINI_KEYS = [
  process.env.GEMINI_KEY_1 || process.env.GEMINI_API_KEY || "",
  process.env.GEMINI_KEY_2 || process.env.GEMINI_API_KEY_SECONDARY || "",
  process.env.GEMINI_KEY_3 || "",
].filter(Boolean);
const BACKUP_BASE_RAW = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const BACKUP_BASE_URL = BACKUP_BASE_RAW.replace(/\/+$/, "");
const BACKUP_MODEL = process.env.AI_BACKUP_MODEL || "gemini-flash-lite-latest";

// ── Per-user in-process rate limit (5 req / 60 s) ─────────────────────────────
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_MAX = 5;
const aiRateMap = new Map<string, { count: number; windowStart: number }>();

function checkAiRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = aiRateMap.get(userId);
  if (!entry || now - entry.windowStart > AI_RATE_WINDOW_MS) {
    aiRateMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= AI_RATE_MAX) return false;
  entry.count++;
  return true;
}

async function callGeminiFallback(
  messages: { role: string; content: string }[]
): Promise<string | null> {
  if (GEMINI_KEYS.length === 0) return null;
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const geminiBase = BACKUP_BASE_URL.endsWith("/models")
    ? BACKUP_BASE_URL
    : `${BACKUP_BASE_URL}/models`;
  const models = Array.from(
    new Set([BACKUP_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-pro"])
  );

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
          signal: AbortSignal.timeout(10_000),
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
  if (!session) {
    return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });
  }

  // Rate limit
  if (!checkAiRateLimit(session.id)) {
    return NextResponse.json(
      { error: "\u062D\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u062A\u062C\u0627\u0648\u0632\u062A. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u0629." },
      { status: 429 }
    );
  }

  let body: { messages?: unknown; courses?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, courses } = body;

  // Guard: messages must be an array, cap at 20 items, each content max 2000 chars
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }
  const safeMessages = (messages as { role?: unknown; content?: unknown }[])
    .slice(0, 20)
    .filter((m) => typeof m.role === "string" && typeof m.content === "string")
    .map((m) => ({
      role: String(m.role).slice(0, 50),
      content: String(m.content).slice(0, 2000),
    }));

  // Guard: courses must be an array of strings, cap at 30 items
  const safeCourses = Array.isArray(courses)
    ? (courses as unknown[]).slice(0, 30).map((c) => String(c).slice(0, 200))
    : [];

  const systemPrompt = [
    "\u0623\u0646\u062A \u0645\u0633\u0627\u0639\u062F \u062A\u062F\u0631\u064A\u0628\u064A \u0630\u0643\u064A \u0644\u0645\u0646\u0635\u0629 \u0643\u0648\u0631\u0633\u0627\u062A \u0645\u0635\u0631\u064A\u0629. \u0645\u0647\u0645\u062A\u0643 \u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0645\u062A\u0639\u0644\u0645\u064A\u0646 \u0641\u064A \u0648\u0636\u0639 \u062E\u0637\u0637 \u062A\u062F\u0631\u064A\u0628\u064A\u0629 \u064A\u0648\u0645\u064A\u0629.",
    `\u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644 \u0641\u064A\u0647\u0627 \u0627\u0644\u0645\u062A\u0639\u0644\u0645: ${safeCourses.join(", ") || "\u0644\u0627 \u064A\u0648\u062C\u062F \u0643\u0648\u0631\u0633\u0627\u062A"}`,
    "\u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u062F\u0627\u0626\u0645\u064B\u0627. \u0643\u0646 \u0645\u0641\u064A\u062F\u064B\u0627 \u0648\u062F\u0627\u0639\u0645\u064B\u0627.",
  ].join("\n");

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...safeMessages,
  ];

  const reply =
    (await callGeminiFallback(formattedMessages)) ||
    "\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0642\u064A\u062F \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u062D\u0627\u0644\u064A\u064B\u0627\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627 \u23F3";

  return NextResponse.json({ reply });
}
