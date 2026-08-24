// =========================================================
// QUOTA MANAGER — Code-UP Platform (client-side localStorage)
// Tracks Gemini API usage; resets daily automatically.
// =========================================================

export type ModelId =
  | "gemini-2.5-flash"
  | "gemini-2.0-flash"
  | "gemini-2.5-flash-tts"
  | "gemini-2.0-flash-live-001"
  | "gemini-2.5-flash-preview-native-audio-dialog"
  | "gemini-2.0-flash-live-translate";

export type TaskType =
  | "student-chat"        // طالب يسأل سؤال
  | "student-hint"        // تلميح أثناء اللعبة
  | "question-generation" // توليد أسئلة للـ DB
  | "iq-report"           // تقرير IQ بعد الجلسة
  | "voice-interaction"   // تفاعل صوتي
  | "translation"         // ترجمة
  | "tts-playback";       // قراءة نص بصوت

// ── Quota limits (matches Google AI Studio free tier) ──────────────────────
export const QUOTA_LIMITS: Record<ModelId, { rpm: number | null; tpm: number; rpd: number | null }> = {
  "gemini-2.5-flash":                               { rpm: 5,    tpm: 250_000,   rpd: 20   },
  "gemini-2.0-flash":                               { rpm: 15,   tpm: 250_000,   rpd: 500  },
  "gemini-2.5-flash-tts":                           { rpm: 3,    tpm: 10_000,    rpd: 10   },
  "gemini-2.0-flash-live-001":                      { rpm: null, tpm: 65_000,    rpd: null }, // ∞
  "gemini-2.5-flash-preview-native-audio-dialog":   { rpm: null, tpm: 1_000_000, rpd: null }, // ∞
  "gemini-2.0-flash-live-translate":                { rpm: null, tpm: 20_000,    rpd: null }, // ∞
};

// ── Task → model routing (Live-first for student-facing tasks) ─────────────
export const TASK_ROUTING: Record<TaskType, ModelId[]> = {
  "student-chat":        ["gemini-2.0-flash-live-001",     "gemini-2.0-flash"],
  "student-hint":        ["gemini-2.0-flash-live-001",     "gemini-2.0-flash"],
  "voice-interaction":   ["gemini-2.5-flash-preview-native-audio-dialog", "gemini-2.0-flash-live-001"],
  "translation":         ["gemini-2.0-flash-live-translate","gemini-2.0-flash-live-001","gemini-2.0-flash"],
  "tts-playback":        ["gemini-2.5-flash-tts",           "gemini-2.0-flash-live-001"],
  "question-generation": ["gemini-2.0-flash",              "gemini-2.5-flash"],
  "iq-report":           ["gemini-2.5-flash",               "gemini-2.0-flash"],
};

const QUOTA_KEY = "codeup_quota_v1";

// Key index tracked client-side (mirrors server-side _keyIndex in ai-caller.ts)
let _clientKeyIndex = 0;
export function rotateClientKey() { _clientKeyIndex = (_clientKeyIndex + 1) % 2; }
export function getClientKeyIndex() { return _clientKeyIndex; }

interface QuotaState {
  date: string;
  // Tracks per-key usage: key1 and key2
  usage: Partial<Record<string, { requests: number; tokens: number }>>;
}

/** Build a composite storage key that includes which API key was used */
function modelKey(model: ModelId, keyIndex = 0): string {
  return `${model}:k${keyIndex}`;
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function getQuotaState(): QuotaState {
  if (typeof window === "undefined") return { date: todayKey(), usage: {} };
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (!raw) return { date: todayKey(), usage: {} };
    const parsed = JSON.parse(raw) as QuotaState;
    // Daily reset
    if (parsed.date !== todayKey()) return { date: todayKey(), usage: {} };
    return parsed;
  } catch {
    return { date: todayKey(), usage: {} };
  }
}

function saveQuotaState(state: QuotaState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
}

function getModelUsage(model: ModelId) {
  const state = getQuotaState();
  return state.usage[model] ?? { requests: 0, tokens: 0 };
}

// ── Select the best available model for a task ─────────────────────────────
export function selectModel(task: TaskType): ModelId {
  const candidates = TASK_ROUTING[task];

  for (const model of candidates) {
    const limit = QUOTA_LIMITS[model];
    if (limit.rpd === null) return model; // ∞ — always use
    const usage = getModelUsage(model);
    const safeLimit = Math.floor(limit.rpd * 0.9); // 10% emergency buffer
    if (usage.requests < safeLimit) return model;
    console.warn(`[Quota] ${model} near limit (${usage.requests}/${limit.rpd}), trying fallback`);
  }

  console.error("[Quota] All preferred models near limit, falling back to flash");
  return "gemini-2.0-flash";
}

// ── Record usage after every API call ─────────────────────────────────────
export function recordUsage(model: ModelId, tokensUsed: number) {
  const state = getQuotaState();
  const cur = state.usage[model] ?? { requests: 0, tokens: 0 };
  state.usage[model] = { requests: cur.requests + 1, tokens: cur.tokens + tokensUsed };
  saveQuotaState(state);
}

// ── Read remaining quota (for dashboard / admin) ───────────────────────────
export function getRemainingQuota(model: ModelId): {
  requestsUsed: number;
  requestsLeft: number | "∞";
  tokensUsed: number;
  percentage: number;
} {
  const limit = QUOTA_LIMITS[model];
  const usage = getModelUsage(model);
  if (limit.rpd === null) {
    return { requestsUsed: usage.requests, requestsLeft: "∞", tokensUsed: usage.tokens, percentage: 0 };
  }
  return {
    requestsUsed: usage.requests,
    requestsLeft: Math.max(0, limit.rpd - usage.requests),
    tokensUsed:   usage.tokens,
    percentage:   Math.round((usage.requests / limit.rpd) * 100),
  };
}

// ── Guard for expensive models ─────────────────────────────────────────────
export function canUseModel(model: ModelId, minRemaining = 2): boolean {
  const { requestsLeft } = getRemainingQuota(model);
  if (requestsLeft === "∞") return true;
  return requestsLeft >= minRemaining;
}

// ── Summary for admin panel ────────────────────────────────────────────────
export function getAllQuotaSummary() {
  return (Object.keys(QUOTA_LIMITS) as ModelId[]).map(model => ({
    model,
    ...getRemainingQuota(model),
    limit: QUOTA_LIMITS[model].rpd ?? "∞",
  }));
}
