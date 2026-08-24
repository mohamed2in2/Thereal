import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(filename: string): Record<string, string> {
  const p = join(process.cwd(), filename);
  if (!existsSync(p)) return {};
  const content = readFileSync(p, "utf8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

function mask(str: string | undefined): string {
  if (!str) return "(NOT SET)";
  if (str.length <= 8) return "******";
  return `${str.slice(0, 4)}...${str.slice(-4)} (${str.length} chars)`;
}

async function testAIEndpoints() {
  console.log("\n=================== ENVIRONMENT CONFIGURATION ===================");
  console.log(`DATABASE_URL:          ${mask(env.DATABASE_URL)}`);
  console.log(`JWT_SECRET:            ${mask(env.JWT_SECRET)}`);
  console.log(`XKIRO_API_KEY:         ${mask(env.XKIRO_API_KEY)}`);
  console.log(`GROQ_API_KEY:          ${mask(env.GROQ_API_KEY)}`);
  console.log(`AI_PRIMARY_API_KEY:    ${mask(env.AI_PRIMARY_API_KEY || env.DEEPSEEK_API_KEY)}`);
  console.log(`GEMINI_API_KEY:        ${mask(env.GEMINI_API_KEY || env.GEMINI_KEY_1)}`);
  console.log(`GEMINI_KEY_2:          ${mask(env.GEMINI_KEY_2 || env.GEMINI_API_KEY_SECONDARY)}`);
  console.log(`GEMINI_KEY_3:          ${mask(env.GEMINI_KEY_3)}`);
  console.log(`AWS_ACCESS_KEY_ID:     ${mask(env.AWS_ACCESS_KEY_ID)}`);
  console.log(`WHATSAPP_TOKEN:        ${mask(env.WHATSAPP_PERMANENT_TOKEN)}`);
  console.log("=================================================================\n");

  console.log("------------------ TESTING AI PROVIDERS ------------------");

  // 1. Test XKiro
  if (env.XKIRO_API_KEY) {
    try {
      const baseUrl = (env.XKIRO_BASE_URL || "https://api.xkiro.com/v1").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.XKIRO_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.XKIRO_MODEL || "deepseek/deepseek-v4-flash",
          messages: [{ role: "user", content: "قل مرحباً فقط" }],
          max_tokens: 20,
        }),
      });
      console.log(`[XKiro (${env.XKIRO_MODEL || "deepseek/deepseek-v4-flash"})]: HTTP ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`  -> Response: ${JSON.stringify(data.choices?.[0]?.message?.content)}`);
      } else {
        const err = await res.text();
        console.log(`  -> Error: ${err.slice(0, 160)}`);
      }
    } catch (e: any) {
      console.log(`[XKiro]: Network error: ${e.message}`);
    }
  } else {
    console.log("[XKiro]: No XKIRO_API_KEY configured.");
  }

  // 2. Test Groq
  if (env.GROQ_API_KEY) {
    const groqModel = env.GROQ_MODEL || "llama-3.3-70b-versatile";
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: "user", content: "قل مرحباً فقط" }],
          max_tokens: 20,
        }),
      });
      console.log(`[Groq (${groqModel})]: HTTP ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`  -> Response: ${JSON.stringify(data.choices?.[0]?.message?.content)}`);
      } else {
        const err = await res.text();
        console.log(`  -> Error: ${err.slice(0, 160)}`);
      }
    } catch (e: any) {
      console.log(`[Groq]: Network error: ${e.message}`);
    }
  } else {
    console.log("[Groq]: No GROQ_API_KEY configured.");
  }

  // 3. Test Gemini Keys
  const geminiKeys = [
    { name: "GEMINI_KEY_1 / GEMINI_API_KEY", key: env.GEMINI_KEY_1 || env.GEMINI_API_KEY || env.GEMINI_API_KEY_1 },
    { name: "GEMINI_KEY_2", key: env.GEMINI_KEY_2 || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY_SECONDARY },
    { name: "GEMINI_KEY_3", key: env.GEMINI_KEY_3 || env.GEMINI_API_KEY_3 },
  ].filter((k) => Boolean(k.key));

  if (geminiKeys.length > 0) {
    for (const { name, key } of geminiKeys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "قل مرحباً فقط" }] }],
              generationConfig: { maxOutputTokens: 20 },
            }),
          }
        );
        console.log(`[Gemini (${name})]: HTTP ${res.status} ${res.statusText}`);
        if (res.ok) {
          const data = await res.json() as any;
          console.log(`  -> Response: ${JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.text)}`);
        } else {
          const err = await res.text();
          console.log(`  -> Error: ${err.slice(0, 160)}`);
        }
      } catch (e: any) {
        console.log(`[Gemini (${name})]: Network error: ${e.message}`);
      }
    }
  } else {
    console.log("[Gemini]: No Gemini API keys configured.");
  }

  console.log("----------------------------------------------------------\n");
}

testAIEndpoints().catch(console.error);
