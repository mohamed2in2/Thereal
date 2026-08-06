// ─── Types ───────────────────────────────────────────────────────────────────
export const IQ_KEY = "codeup_iq_v1";

export type IQSkillName =
  | "speed"
  | "memory"
  | "attention"
  | "flexibility"
  | "linguistic"
  | "logical"
  | "spatial"
  | "problemsolving";

export type Difficulty = "easy" | "medium" | "hard";

export interface IQSession {
  score: number;
  date: number;
  subject: string;
  difficulty: string;
  level: number;
}

export interface IQSkill {
  score: number;       // ELO-style score (500–2000)
  sessions: IQSession[];
  level: string;       // مبتدئ / متوسط / متقدم / خبير / نخبة
}

export interface IQData {
  userId: string | null;
  skills: Record<IQSkillName, IQSkill>;
  overallIQ: number;
  totalGamesPlayed: number;
  streak: { current: number; best: number; lastDate: string | null };
  lastUpdated: number | null;
}

// ─── Defaults ────────────────────────────────────────────────────────────────
function defaultSkill(): IQSkill {
  return { score: 1000, sessions: [], level: "متوسط" };
}

export const defaultIQData: IQData = {
  userId: null,
  skills: {
    speed:          defaultSkill(),
    memory:         defaultSkill(),
    attention:      defaultSkill(),
    flexibility:    defaultSkill(),
    linguistic:     defaultSkill(),
    logical:        defaultSkill(),
    spatial:        defaultSkill(),
    problemsolving: defaultSkill(),
  },
  overallIQ: 1000,
  totalGamesPlayed: 0,
  streak: { current: 0, best: 0, lastDate: null },
  lastUpdated: null,
};

// ─── Subject → Skill mapping ──────────────────────────────────────────────────
export const SUBJECT_SKILLS: Record<string, IQSkillName[]> = {
  math:       ["logical", "speed"],
  physics:    ["spatial", "logical", "flexibility"],
  chemistry:  ["memory", "logical"],
  biology:    ["memory", "attention"],
  history:    ["memory", "flexibility"],
  geography:  ["spatial", "memory"],
  languages:  ["linguistic", "speed", "attention"],
  coding:     ["problemsolving", "logical"],
};

// ─── Labels & Colors (matches screenshot palette) ─────────────────────────────
export const SKILL_LABELS: Record<IQSkillName, string> = {
  speed:          "السرعة",
  memory:         "الذاكرة",
  attention:      "التركيز",
  flexibility:    "المرونة",
  linguistic:     "اللغة",
  logical:        "الرياضيات",
  spatial:        "التفكير المكاني",
  problemsolving: "حل المشاكل",
};

export const SKILL_COLORS: Record<IQSkillName, string> = {
  speed:          "#E91E63",  // pink
  memory:         "#9C27B0",  // purple
  attention:      "#FF9800",  // orange
  flexibility:    "#FF5722",  // deep orange
  linguistic:     "#F06292",  // hot pink
  logical:        "#2196F3",  // blue
  spatial:        "#00BCD4",  // cyan
  problemsolving: "#009688",  // teal
};

// Skills shown in the IQ dashboard (ordered like screenshot)
export const DASHBOARD_SKILLS: IQSkillName[] = [
  "speed", "memory", "attention", "flexibility", "linguistic", "logical", "problemsolving",
];

// ─── Level labels ─────────────────────────────────────────────────────────────
export function getIQLevel(score: number): string {
  if (score < 700)  return "مبتدئ";
  if (score < 1000) return "تحت المتوسط";
  if (score < 1200) return "متوسط";
  if (score < 1400) return "متقدم";
  if (score < 1700) return "خبير";
  return "نخبة";
}

export const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  "مبتدئ":        { bg: "#9E9E9E22", color: "#757575" },
  "تحت المتوسط":  { bg: "#2196F322", color: "#1976D2" },
  "متوسط":        { bg: "#7F77DD22", color: "#7F77DD" },
  "متقدم":        { bg: "#FF980022", color: "#E65100" },
  "خبير":         { bg: "#E91E6322", color: "#C2185B" },
  "نخبة":         { bg: "#534AB722", color: "#534AB7" },
};

// ─── Storage ──────────────────────────────────────────────────────────────────
export function getIQData(): IQData {
  if (typeof window === "undefined") return JSON.parse(JSON.stringify(defaultIQData));
  try {
    const raw = localStorage.getItem(IQ_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultIQData));
    const parsed = JSON.parse(raw) as IQData;
    // Forward-compat: ensure all skills exist
    (Object.keys(defaultIQData.skills) as IQSkillName[]).forEach(k => {
      if (!parsed.skills[k]) parsed.skills[k] = defaultSkill();
    });
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(defaultIQData));
  }
}

export function saveIQData(data: IQData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(IQ_KEY, JSON.stringify(data));
}

// ─── Scoring formula ──────────────────────────────────────────────────────────
/**
 * Session score based on cognitive science criteria:
 *
 * 1. Accuracy  (0–800): nonlinear (accuracy^1.5) → 80% acc = 571 pts, 100% = 800
 * 2. Speed     (0–300): bonus for using < 50% of allowed time
 * 3. Level     (0–400): reflects difficulty ceiling you reached
 * 4. Streak    (0–200): consistency reward
 *
 * Then applied as Exponential Moving Average (EMA α=0.35) to skill score
 * so recent sessions count more, with a ±150 cap per session to avoid swings.
 */
export function calcSessionScore(params: {
  correct: number;
  total: number;
  totalTimeMs: number;
  avgLevel: number;   // 1–10
  maxStreak: number;
}): number {
  const { correct, total, totalTimeMs, avgLevel, maxStreak } = params;
  const accuracy      = correct / total;
  const accuracyScore = Math.pow(accuracy, 1.5) * 800;

  const avgTimeSec    = totalTimeMs / total / 1000;
  const baseTime      = 15; // baseline seconds/question
  const speedRatio    = Math.max(0, 1 - avgTimeSec / baseTime);
  const speedScore    = speedRatio * 300;

  const levelScore    = (avgLevel / 10) * 400;
  const streakBonus   = Math.min(maxStreak * 20, 200);

  return Math.round(accuracyScore + speedScore + levelScore + streakBonus);
}

// ─── Core update ──────────────────────────────────────────────────────────────
export interface GameResult {
  correct: number;
  total: number;
  totalTimeMs: number;
  avgLevel: number;
  maxStreak: number;
  difficulty: Difficulty;
}

export function updateIQ(
  subject: string,
  result: GameResult | number,          // accepts legacy (number=correctAnswers) or new object
  totalQuestionsLegacy?: number,
  totalTimeMsLegacy?: number,
  difficultyLegacy?: Difficulty,
): { sessionScore: number; newOverallIQ: number } {
  let sessionScore: number;
  let difficulty: Difficulty;
  let avgLevel: number;

  // Support both new GameResult interface and legacy (correctAnswers, totalQ, ms, diff)
  if (typeof result === "object") {
    sessionScore = calcSessionScore(result);
    difficulty   = result.difficulty;
    avgLevel     = result.avgLevel;
  } else {
    const correct = result;
    const total   = totalQuestionsLegacy ?? 10;
    const ms      = totalTimeMsLegacy ?? 60000;
    difficulty    = difficultyLegacy ?? "medium";
    avgLevel      = difficulty === "easy" ? 2 : difficulty === "medium" ? 5 : 8;
    sessionScore  = calcSessionScore({ correct, total, totalTimeMs: ms, avgLevel, maxStreak: 0 });
  }

  const data   = getIQData();
  const skills = (SUBJECT_SKILLS[subject] || ["logical"]) as IQSkillName[];
  const alpha  = 0.35; // EMA learning rate
  const MAX_CHANGE = 150;

  skills.forEach(skill => {
    const old = data.skills[skill].score;
    // EMA update, capped to avoid wild swings
    const raw = Math.round(alpha * sessionScore + (1 - alpha) * old);
    const capped = Math.max(old - MAX_CHANGE, Math.min(old + MAX_CHANGE, raw));
    data.skills[skill].score = Math.max(200, Math.min(2000, capped));
    data.skills[skill].level = getIQLevel(data.skills[skill].score);
    data.skills[skill].sessions.push({
      score: sessionScore,
      date: Date.now(),
      subject,
      difficulty,
      level: avgLevel,
    });
    if (data.skills[skill].sessions.length > 30) data.skills[skill].sessions.shift();
  });

  // Overall = weighted average (higher-played skills count more)
  const allScores = Object.values(data.skills).map(s => s.score);
  data.overallIQ = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  data.totalGamesPlayed++;
  data.lastUpdated = Date.now();
  saveIQData(data);

  // Sync to server (fire-and-forget, no await so games aren't blocked)
  void syncIQToServer(data);

  return { sessionScore, newOverallIQ: data.overallIQ };
}

// ─── Server sync ──────────────────────────────────────────────────────────────
export async function syncIQToServer(data: IQData): Promise<void> {
  try {
    await fetch("/api/student/iq", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iqData: JSON.stringify(data) }),
    });
  } catch {
    // Silent fail — localStorage is source of truth
  }
}

// ─── Dynamic level helpers ────────────────────────────────────────────────────
export function levelToDifficulty(level: number): Difficulty {
  if (level <= 3) return "easy";
  if (level <= 6) return "medium";
  return "hard";
}

export function difficultyToStartLevel(diff: Difficulty): number {
  return diff === "easy" ? 2 : diff === "medium" ? 5 : 8;
}

/** Return the adjusted timer (seconds) for a given level */
export function levelToTimer(level: number, baseSecs: Record<Difficulty, number>): number {
  const diff = levelToDifficulty(level);
  const base = baseSecs[diff];
  // Tighter timer at higher levels: level 10 = 60% of base time
  const ratio = 1 - ((level - 1) / 9) * 0.4;
  return Math.max(5, Math.round(base * ratio));
}

// ─── Recommended difficulty ───────────────────────────────────────────────────
export function getRecommendedDifficulty(subject: string): Difficulty {
  const data = getIQData();
  const skills = (SUBJECT_SKILLS[subject] || ["logical"]) as IQSkillName[];
  const avg = skills.reduce((a, s) => a + data.skills[s].score, 0) / skills.length;
  if (avg < 900)  return "easy";
  if (avg < 1300) return "medium";
  return "hard";
}

// ─── Vibration ────────────────────────────────────────────────────────────────
export function vibrate(type: "correct" | "wrong" | "streak" | "levelup"): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (type === "correct") navigator.vibrate(50);
  if (type === "wrong")   navigator.vibrate([100, 50, 100]);
  if (type === "streak")  navigator.vibrate([50, 30, 50, 30, 100]);
  if (type === "levelup") navigator.vibrate([100, 50, 100, 50, 200]);
}
