process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { parseAIResponse } from "../src/lib/ai-assistant";

async function main() {
  const fenced = parseAIResponse('```json\n{"message":"أهلاً بك","actions":[]}\n```', "backup");
  assert.equal(fenced.message, "أهلاً بك");

  const plain = parseAIResponse("رد عربي مباشر بدون JSON", "primary");
  assert.equal(plain.message, "رد عربي مباشر بدون JSON");

  const clean = parseAIResponse("إجابة عربية Привет سليمة", "primary");
  assert.equal(/[\u0400-\u04FF]/.test(clean.message), false);
  assert.match(clean.message, /إجابة عربية/);

  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/ai-assistant.ts", import.meta.url), "utf8")
  );
  assert.match(source, /GEMINI_KEY_1/);
  assert.match(source, /GEMINI_KEY_2/);
  assert.match(source, /GEMINI_KEY_3/);
  assert.match(source, /GEMINI_API_KEY/);
  assert.match(source, /gemini-flash-latest/);
  assert.match(source, /gemini-1\.5-flash/);
  assert.match(source, /PROVIDER_TIMEOUT_MS\s*=\s*12_000/);

  console.log("AI provider parser and rotation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
