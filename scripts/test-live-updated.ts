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

async function testUpdatedLive() {
  console.log("\n=================== LIVE TESTING ALL CONFIGURED AI APIS ===================");

  // 1. Aerolink Primary
  const aerolinkKey = env.XKIRO_API_KEY || "aero_live_R8unXw1p5ZaoQVRwmOFAMki3f0IReK3fHeZ4JD2MHCY";
  const aerolinkBase = env.XKIRO_BASE_URL || "https://cgapi.aerolink.lat/v1";
  const aerolinkModel = env.XKIRO_MODEL || "gpt-5.6-sol";
  try {
    const res = await fetch(`${aerolinkBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aerolinkKey}`,
      },
      body: JSON.stringify({
        model: aerolinkModel,
        messages: [{ role: "user", content: "ما هي عاصمة مصر؟ أجب بكلمة واحدة فقط." }],
        max_tokens: 30,
      }),
    });
    console.log(`[Aerolink (${aerolinkModel})]: HTTP ${res.status}`);
    if (res.ok) {
      const data = await res.json() as any;
      console.log(`  -> Response: ${data.choices?.[0]?.message?.content?.trim()}`);
    } else {
      console.log(`  -> Error: ${await res.text()}`);
    }
  } catch (e: any) {
    console.log(`[Aerolink]: Error: ${e.message}`);
  }

  // 2. Gemini with gemini-2.5-flash and gemini-flash-latest
  const geminiKey = env.GEMINI_KEY_1 || env.GEMINI_API_KEY;
  if (geminiKey) {
    for (const model of ["gemini-2.5-flash", "gemini-flash-latest"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ما هي عاصمة مصر؟ أجب بكلمة واحدة فقط." }] }],
              generationConfig: { maxOutputTokens: 300 },
            }),
          }
        );
        console.log(`[Gemini (${model})]: HTTP ${res.status}`);
        if (res.ok) {
          const data = await res.json() as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          console.log(`  -> Response: ${text ?? JSON.stringify(data).slice(0, 100)}`);
        } else {
          console.log(`  -> Error: ${(await res.text()).slice(0, 160)}`);
        }
      } catch (e: any) {
        console.log(`[Gemini (${model})]: Error: ${e.message}`);
      }
    }
  }

  // 3. Groq with qwen/qwen3.6-27b or allam-2-7b
  if (env.GROQ_API_KEY) {
    for (const model of ["allam-2-7b", "qwen/qwen3.6-27b"]) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "ما هي عاصمة مصر؟ أجب بكلمة واحدة فقط." }],
            max_tokens: 30,
          }),
        });
        console.log(`[Groq (${model})]: HTTP ${res.status}`);
        if (res.ok) {
          const data = await res.json() as any;
          console.log(`  -> Response: ${data.choices?.[0]?.message?.content?.trim()}`);
        } else {
          console.log(`  -> Error: ${(await res.text()).slice(0, 160)}`);
        }
      } catch (e: any) {
        console.log(`[Groq (${model})]: Error: ${e.message}`);
      }
    }
  }

  console.log("===========================================================================\n");
}

testUpdatedLive().catch(console.error);
