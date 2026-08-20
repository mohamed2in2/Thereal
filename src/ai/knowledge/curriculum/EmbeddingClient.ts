/**
 * Real text embeddings from the Gemini embedding endpoint.
 *
 * BaseProvider.embed() returns random vectors — a placeholder that is fine for
 * wiring tests but meaningless for retrieval. Curriculum search therefore uses
 * this client directly, and treats any failure as "no semantic signal" so that
 * lexical retrieval carries the query on its own.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

function apiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY_1 ||
    process.env.GEMINI_API_KEY_SECONDARY ||
    null
  );
}

export function embeddingsAvailable(): boolean {
  const key = apiKey();
  return Boolean(key) && !key!.includes("sandbox");
}

export interface EmbedOptions {
  /** RETRIEVAL_DOCUMENT when indexing, RETRIEVAL_QUERY when searching. */
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
  timeoutMs?: number;
}

export async function embedText(
  text: string,
  options: EmbedOptions = {}
): Promise<Float32Array | null> {
  const key = apiKey();
  if (!key || !text.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

  try {
    const response = await fetch(`${ENDPOINT}/${EMBEDDING_MODEL}:embedContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": key },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: options.taskType ?? "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    const values = payload.embedding?.values;
    if (!Array.isArray(values) || !values.length) return null;
    return normalise(Float32Array.from(values));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Unit-length vectors let cosine similarity reduce to a dot product. */
export function normalise(vector: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const magnitude = Math.sqrt(sum);
  if (!magnitude) return vector;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) out[i] = vector[i] / magnitude;
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += a[i] * b[i];
  return sum;
}
