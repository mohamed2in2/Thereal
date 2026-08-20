/**
 * Generates embeddings for the ingested curriculum chunks.
 *
 *   node scripts/curriculum/embed.mjs [--force]
 *
 * Idempotent: vectors are keyed by chunk id, and a chunk whose id is already
 * embedded is skipped unless --force is passed. Chunk ids are content-derived,
 * so re-ingesting unchanged PDFs re-uses every existing vector and costs
 * nothing.
 */

import { promises as fs } from "fs";
import path from "path";
import process from "process";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "src", "ai", "knowledge", "curriculum");
const CHUNKS_FILE = path.join(DATA_DIR, "curriculum_chunks.json");
const VECTORS_FILE = path.join(DATA_DIR, "curriculum_vectors.json");

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 6;

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env"), "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* .env is optional when the key is already exported */
  }
}

function apiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY_1 ||
    process.env.GEMINI_API_KEY_SECONDARY ||
    null
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalise(values) {
  let sum = 0;
  for (const v of values) sum += v * v;
  const magnitude = Math.sqrt(sum);
  if (!magnitude) return values;
  return values.map((v) => Number((v / magnitude).toFixed(6)));
}

/** Give the embedding model the chunk's place in the book, not just its text. */
function embeddingInput(chunk) {
  return [
    `${chunk.subject_ar} — ${chunk.grade_ar}`,
    `الفصل ${chunk.chapter_number}: ${chunk.chapter_title || ""}`,
    `الدرس ${chunk.lesson_number}: ${chunk.lesson_title || ""}`,
    chunk.section_title ? `القسم: ${chunk.section_title}` : "",
    chunk.text,
  ]
    .filter(Boolean)
    .join("\n");
}

async function embedOne(key, chunk) {
  let lastError = new Error("no attempt made");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({
          model: `models/${MODEL}`,
          content: { parts: [{ text: embeddingInput(chunk) }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: DIMENSIONS,
        }),
      });

      if (response.status === 429 || response.status >= 500) {
        // Exponential backoff with jitter: the free embedding tier throttles
        // hard, and a fixed delay just marches every worker into the next 429.
        await sleep(Math.min(30000, 2 ** attempt * 1000) + Math.random() * 750);
        lastError = new Error(`HTTP ${response.status} after ${attempt} attempts`);
        continue;
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      const payload = await response.json();
      const values = payload?.embedding?.values;
      if (!Array.isArray(values) || !values.length) {
        throw new Error("empty embedding in response");
      }
      return normalise(values);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(Math.min(30000, 2 ** attempt * 1000) + Math.random() * 750);
    }
  }
  throw lastError;
}

async function main() {
  await loadEnv();
  const key = apiKey();
  if (!key) {
    console.error("No GEMINI_API_KEY / GEMINI_KEY_1 found. Aborting.");
    return 1;
  }

  const force = process.argv.includes("--force");
  const chunks = JSON.parse(await fs.readFile(CHUNKS_FILE, "utf-8"));

  let existing = { model: MODEL, dimensions: DIMENSIONS, vectors: {} };
  if (!force) {
    try {
      const parsed = JSON.parse(await fs.readFile(VECTORS_FILE, "utf-8"));
      if (parsed.model === MODEL && parsed.dimensions === DIMENSIONS) existing = parsed;
    } catch {
      /* first run */
    }
  }

  const pending = chunks.filter((chunk) => !existing.vectors[chunk.id]);
  const liveIds = new Set(chunks.map((chunk) => chunk.id));
  // Drop vectors whose chunk no longer exists, so re-ingestion cannot leave orphans.
  for (const id of Object.keys(existing.vectors)) {
    if (!liveIds.has(id)) delete existing.vectors[id];
  }

  console.error(
    `${chunks.length} chunks, ${chunks.length - pending.length} already embedded, ${pending.length} to do.`
  );
  if (!pending.length) {
    await fs.writeFile(VECTORS_FILE, JSON.stringify(existing), "utf-8");
    console.error("Nothing to embed. Vector file is up to date.");
    return 0;
  }

  let done = 0;
  let failed = 0;
  const queue = [...pending];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const chunk = queue.shift();
      if (!chunk) break;
      try {
        existing.vectors[chunk.id] = await embedOne(key, chunk);
      } catch (error) {
        failed += 1;
        console.error(`  failed ${chunk.id} (${chunk.lesson_number}): ${error.message}`);
      }
      done += 1;
      if (done % 25 === 0) {
        console.error(`  ${done}/${pending.length}`);
        // Checkpoint so an interrupted run resumes instead of restarting.
        await fs.writeFile(VECTORS_FILE, JSON.stringify(existing), "utf-8");
      }
    }
  });
  await Promise.all(workers);

  await fs.writeFile(VECTORS_FILE, JSON.stringify(existing), "utf-8");
  console.error(
    `Wrote ${Object.keys(existing.vectors).length} vectors to curriculum_vectors.json (${failed} failed).`
  );
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code));
