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

async function testModels() {
  // Test Groq models
  if (env.GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      });
      console.log(`[Groq models endpoint]: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json() as any;
        const ids = (data.data || []).map((m: any) => m.id);
        console.log("Available Groq models:", ids);
      }
    } catch (e: any) {
      console.log("Groq models error:", e.message);
    }
  }

  // Test Gemini models
  const geminiKey = env.GEMINI_KEY_1 || env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      console.log(`[Gemini models endpoint]: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json() as any;
        const names = (data.models || []).map((m: any) => m.name.replace("models/", ""));
        console.log("Available Gemini models:", names.slice(0, 15));
      } else {
        const txt = await res.text();
        console.log("Gemini models error text:", txt);
      }
    } catch (e: any) {
      console.log("Gemini models error:", e.message);
    }
  }

  // Test Aerolink with user's key
  const aerolinkKey = "aero_live_R8unXw1p5ZaoQVRwmOFAMki3f0IReK3fHeZ4JD2MHCY";
  try {
    const res = await fetch("https://cgapi.aerolink.lat/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aerolinkKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        messages: [{ role: "user", content: "قل مرحباً" }],
        max_tokens: 30,
      }),
    });
    console.log(`[Aerolink (gpt-5.6-sol)]: HTTP ${res.status}`);
    if (res.ok) {
      const data = await res.json() as any;
      console.log("Aerolink response:", data.choices?.[0]?.message?.content);
    } else {
      console.log("Aerolink error:", await res.text());
    }
  } catch (e: any) {
    console.log("Aerolink error:", e.message);
  }
}

testModels().catch(console.error);
