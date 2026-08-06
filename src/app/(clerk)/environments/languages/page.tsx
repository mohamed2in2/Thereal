"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";
import {
  updateIQ, getIQData, getRecommendedDifficulty, vibrate,
  SKILL_LABELS, SKILL_COLORS, SUBJECT_SKILLS,
  levelToDifficulty, difficultyToStartLevel, levelToTimer,
  type Difficulty, type IQData, type GameResult,
} from "@/lib/iq-system";
import { GameFeedback } from "@/components/ai/GameFeedback";

/* ─── Word Duel Data & Templates ────────────────────────────────────────── */
interface WordPair {
  ar: string;
  en: string;
  category: "easy" | "medium" | "hard";
}

const WORDS_POOL: WordPair[] = [
  { ar: "كتاب", en: "Book", category: "easy" },
  { ar: "قلم", en: "Pen", category: "easy" },
  { ar: "منزل", en: "House", category: "easy" },
  { ar: "مدرسة", en: "School", category: "easy" },
  { ar: "سيارة", en: "Car", category: "easy" },
  { ar: "ماء", en: "Water", category: "easy" },
  { ar: "شمس", en: "Sun", category: "easy" },
  { ar: "قمر", en: "Moon", category: "easy" },
  { ar: "طالب", en: "Student", category: "easy" },
  { ar: "معلم", en: "Teacher", category: "easy" },
  { ar: "باب", en: "Door", category: "easy" },
  { ar: "نافذة", en: "Window", category: "easy" },
  { ar: "كرسي", en: "Chair", category: "easy" },
  { ar: "طاولة", en: "Table", category: "easy" },
  { ar: "صديق", en: "Friend", category: "easy" },
  { ar: "عائلة", en: "Family", category: "easy" },
  { ar: "وقت", en: "Time", category: "easy" },
  { ar: "يوم", en: "Day", category: "easy" },
  { ar: "ليل", en: "Night", category: "easy" },
  { ar: "صباح", en: "Morning", category: "easy" },
  { ar: "رجل", en: "Man", category: "easy" },
  { ar: "امرأة", en: "Woman", category: "easy" },
  { ar: "ولد", en: "Boy", category: "easy" },
  { ar: "بنت", en: "Girl", category: "easy" },
  { ar: "مستشفى", en: "Hospital", category: "medium" },
  { ar: "مطار", en: "Airport", category: "medium" },
  { ar: "حكومة", en: "Government", category: "medium" },
  { ar: "اقتصاد", en: "Economy", category: "medium" },
  { ar: "تكنولوجيا", en: "Technology", category: "medium" },
  { ar: "ديمقراطية", en: "Democracy", category: "medium" },
  { ar: "جامعة", en: "University", category: "medium" },
  { ar: "مكتبة", en: "Library", category: "medium" },
  { ar: "برلمان", en: "Parliament", category: "medium" },
  { ar: "فلسفة", en: "Philosophy", category: "medium" },
  { ar: "ثورة", en: "Revolution", category: "medium" },
  { ar: "حضارة", en: "Civilization", category: "medium" },
  { ar: "صناعة", en: "Industry", category: "medium" },
  { ar: "زراعة", en: "Agriculture", category: "medium" },
  { ar: "تجارة", en: "Commerce", category: "medium" },
  { ar: "طاقة", en: "Energy", category: "medium" },
  { ar: "بيئة", en: "Environment", category: "medium" },
  { ar: "ثقافة", en: "Culture", category: "medium" },
  { ar: "استراتيجية", en: "Strategy", category: "hard" },
  { ar: "خوارزمية", en: "Algorithm", category: "hard" },
  { ar: "ديناميكية", en: "Dynamics", category: "hard" },
  { ar: "استدامة", en: "Sustainability", category: "hard" },
  { ar: "كوانتم", en: "Quantum", category: "hard" },
  { ar: "ابستيمولوجيا", en: "Epistemology", category: "hard" },
  { ar: "فينومينولوجيا", en: "Phenomenology", category: "hard" },
  { ar: "ديالكتيك", en: "Dialectic", category: "hard" },
  { ar: "انثروبولوجيا", en: "Anthropology", category: "hard" },
  { ar: "سيميائية", en: "Semiotics", category: "hard" },
  { ar: "هيرمينوطيقا", en: "Hermeneutics", category: "hard" },
  { ar: "إيديولوجية", en: "Ideology", category: "hard" }
];

interface WordQ {
  word: string;
  answer: string;
  choices: string[];
  dir: "ar→en" | "en→ar";
}

// Generate word question based on level
function genWordQ(level: number, usedQuestions: Set<string>): WordQ {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = WORDS_POOL.filter(w => w.category === cat);
  if (pool.length === 0) pool = WORDS_POOL;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `word-${chosen.ar}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `word-${chosen.ar}`;
    attempts++;
  }
  usedQuestions.add(key);

  const dir: "ar→en" | "en→ar" = Math.random() < 0.5 ? "ar→en" : "en→ar";
  const answer = dir === "ar→en" ? chosen.en : chosen.ar;
  const word = dir === "ar→en" ? chosen.ar : chosen.en;

  const wrong = pool.filter(w => (dir === "ar→en" ? w.en : w.ar) !== answer)
    .sort(() => Math.random() - 0.5).slice(0, 3).map(w => dir === "ar→en" ? w.en : w.ar);
  const choices = [answer, ...wrong].sort(() => Math.random() - 0.5);

  return { word, answer, choices, dir };
}

/* ─── Error Sniper Data ─────────────────────────────────────────────────── */
interface SnipeQ {
  sentence: string;
  words: string[];
  wrongIdx: number | null;
  hint: string;
  category: "easy" | "medium" | "hard";
}

const SNIPE_POOL: SnipeQ[] = [
  { sentence: "", words: ["ذهبتُ", "إلى", "المدرسةَ", "أمس"], wrongIdx: 2, hint: "المدرسةِ (اسم مجرور وعلامة جره الكسرة)", category: "easy" },
  { sentence: "", words: ["أكلَ", "الولدُ", "التفاحةُ"], wrongIdx: 2, hint: "التفاحةَ (مفعول به منصوب وعلامة نصبه الفتحة)", category: "easy" },
  { sentence: "", words: ["جاءَ", "المعلمون", "متأخرين"], wrongIdx: null, hint: "الجملة سليمة ونحوية تماماً", category: "easy" },
  { sentence: "", words: ["قرأتُ", "كتابٌ", "مفيد"], wrongIdx: 1, hint: "كتاباً (مفعول به منصوب)", category: "easy" },
  { sentence: "", words: ["إنَّ", "الطالبُ", "مجتهد"], wrongIdx: 1, hint: "الطالبَ (اسم إنَّ منصوب)", category: "easy" },
  { sentence: "", words: ["كتبَ", "المعلمُ", "الدرسَ", "على", "السبورةِ"], wrongIdx: null, hint: "الجملة سليمة ونحوية تماماً", category: "easy" },
  { sentence: "", words: ["رأيتُ", "رجلٌ", "طويل"], wrongIdx: 1, hint: "رجلاً (مفعول به منصوب)", category: "easy" },
  { sentence: "", words: ["سافرَ", "أبي", "إلى", "القاهرةُ"], wrongIdx: 3, hint: "القاهرةِ (اسم مجرور بحرف الجر)", category: "easy" },
  { sentence: "", words: ["لم", "يذهبَ", "الطلابُ", "إلى", "الملعب"], wrongIdx: null, hint: "الجملة سليمة وصحيحة", category: "medium" },
  { sentence: "", words: ["إنَّ", "العلمَ", "نورٌ", "يضيء", "العقول"], wrongIdx: null, hint: "الجملة سليمة ونحوية تماماً", category: "medium" },
  { sentence: "", words: ["المجتهدون", "ينجحُوا", "دائماً"], wrongIdx: 1, hint: "ينجحون (فعل مضارع مرفوع بثبوت النون)", category: "medium" },
  { sentence: "", words: ["أعجبني", "الكتابَ", "الذي", "قرأته"], wrongIdx: 1, hint: "الكتابُ (فاعل مرفوع وعلامة رفعه الضمة)", category: "medium" },
  { sentence: "", words: ["كانَ", "الجوُ", "جميلٌ", "اليوم"], wrongIdx: 2, hint: "جميلاً (خبر كان منصوب بالفتحة)", category: "medium" },
  { sentence: "", words: ["ما", "زارَ", "أحدٌ", "المتحف", "البارحة"], wrongIdx: null, hint: "الجملة سليمة وصحيحة", category: "medium" },
  { sentence: "", words: ["حضرَ", "إلى", "الاجتماعِ", "المديرَ", "والموظفون"], wrongIdx: 3, hint: "المديرُ (فاعل مؤخر مرفوع وعلامة رفعه الضمة)", category: "hard" },
  { sentence: "", words: ["يُعجبني", "أن", "تجتهدَ", "في", "عملك"], wrongIdx: null, hint: "الجملة صحيحة تماماً", category: "hard" },
  { sentence: "", words: ["أيّهم", "اجتهدَ", "ينجح"], wrongIdx: null, hint: "الجملة سليمة تماماً (أداة شرط)", category: "hard" },
  { sentence: "", words: ["لولا", "العلمُ", "لتأخرَ", "الإنسانُ"], wrongIdx: null, hint: "الجملة صحيحة وسليمة", category: "hard" },
  { sentence: "", words: ["أكرمتُ", "مَن", "حضروا", "المحاضرةَ"], wrongIdx: null, hint: "الجملة صحيحة وسليمة", category: "hard" },
  { sentence: "", words: ["رغمَ", "صعوبةُ", "المسألة", "حلَّها"], wrongIdx: 1, hint: "صعوبةِ (مضاف إليه مجرور وعلامة جره الكسرة)", category: "hard" }
];

// Generate sniper question based on level
function genSnipeQ(level: number, usedQuestions: Set<string>): SnipeQ {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = SNIPE_POOL.filter(s => s.category === cat);
  if (pool.length === 0) pool = SNIPE_POOL;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `snipe-${chosen.words.join("_")}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `snipe-${chosen.words.join("_")}`;
    attempts++;
  }
  usedQuestions.add(key);

  return chosen;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TOTAL_Q = 10;
const BASE_TIMERS = { easy: 14, medium: 10, hard: 6 };

const DIFF_LABEL: Record<Difficulty, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const DIFF_COLOR: Record<Difficulty, string> = { easy: "#1D9E75", medium: "#EF9F27", hard: "#D4537E" };

/* ─── Level badge ────────────────────────────────────────────────────────── */
function LevelBadge({ level, anim }: { level: number; anim: boolean }) {
  const diff = levelToDifficulty(level);
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black text-white transition-all ${anim ? "scale-125" : ""}`}
        style={{ background: DIFF_COLOR[diff] }}>
        Lv.{level}
        {anim && <span className="mr-1">⬆️</span>}
      </div>
    </div>
  );
}

/* ─── Word Duel Game ────────────────────────────────────────────────────── */
function WordDuelGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("languages"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<WordQ | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [timerPct, setTimerPct] = useState(100);
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);

  const clear = () => { if (timerRef.current) clearInterval(timerRef.current); if (advRef.current) clearTimeout(advRef.current); };

  const nextQ = useCallback((idx: number) => {
    if (idx >= TOTAL_Q) {
      const avgLevel = levelsRef.current.reduce((a, b) => a + b, 0) / levelsRef.current.length;
      const gameResult: GameResult = {
        correct: correctRef.current,
        total: TOTAL_Q,
        totalTimeMs: totalMsRef.current,
        avgLevel,
        maxStreak: maxStreakRef.current,
        difficulty: levelToDifficulty(levelRef.current),
      };
      const res = updateIQ("languages", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genWordQ(cur, usedQuestionsRef.current));
    setSelected(null);
    setQIdx(idx);
    setTimerPct(100);
    
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      setTimerPct(Math.max(0, 100 - (elapsed / (secs * 1000)) * 100));
      if (elapsed >= secs * 1000) {
        clearInterval(timerRef.current!);
        vibrate("wrong");
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
        setSelected("__timeout__");
        const now = Date.now();
        totalMsRef.current += now - tStartRef.current;
        tStartRef.current = now;
        streakRef.current = 0;
        advRef.current = setTimeout(() => nextQ(idx + 1), 900);
      }
    }, 100);
    tStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  const start = () => {
    clear();
    usedQuestionsRef.current.clear();
    correctRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    levelsRef.current = [];
    totalMsRef.current = 0;
    const startLvl = difficultyToStartLevel(diff);
    levelRef.current = startLvl;
    setLevel(startLvl);
    setCorrect(0);
    setResult(null);
    setState("playing");
    nextQ(0);
  };

  const answer = useCallback((ch: string) => {
    if (selected) return;
    clear();
    setSelected(ch);
    const now = Date.now();
    totalMsRef.current += now - tStartRef.current;
    
    const curLevel = levelRef.current;
    const secs = levelToTimer(curLevel, BASE_TIMERS);
    const timeUsedPct = (now - tStartRef.current) / (secs * 1000);
    
    const ok = ch === q?.answer;
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC;
    setCorrect(newC);
    
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr;
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");

    // Dynamic level adjustment
    const prevLvl = levelRef.current;
    if (ok && timeUsedPct < 0.45 && levelRef.current < 10) {
      levelRef.current = Math.min(10, levelRef.current + 1);
      setLevel(levelRef.current);
      if (levelRef.current > prevLvl) {
        setLevelAnim(true);
        setTimeout(() => setLevelAnim(false), 800);
        vibrate("levelup");
      }
    } else if (!ok && levelRef.current > 1) {
      levelRef.current = Math.max(1, levelRef.current - 1);
      setLevel(levelRef.current);
    }
    
    advRef.current = setTimeout(() => nextQ(qIdx + 1), 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🗣️</div>
      <p className="text-sm mb-2" style={{ color: "var(--ink-3)" }}>ترجمة {TOTAL_Q} كلمات · الوقت والمستوى يتعدل ديناميكياً ⚡</p>
      
      {!isAdaptive && (
        <div className="flex gap-2 justify-center mb-6">
          {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)} className="px-4 py-2 rounded-xl text-sm font-black"
              style={{ background: diff === d ? DIFF_COLOR[d] : "var(--surface-2)", color: diff === d ? "#fff" : "var(--ink-3)", border: `2px solid ${diff === d ? DIFF_COLOR[d] : "var(--border)"}` }}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
      )}
      {isAdaptive && (
        <p className="text-xs mb-5 font-bold" style={{ color: "var(--brand)" }}>
          تم تحديد الصعوبة تلقائياً: {DIFF_LABEL[diff]} ⚡
        </p>
      )}
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#D85A30,#EF9F27)" }}>ابدأ</button>
    </div>
  );

  if (state === "result" && result) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 52 }}>{result.correct >= 8 ? "🏆" : result.correct >= 5 ? "⭐" : "💪"}</div>
      <h3 className="text-2xl font-black mb-1" style={{ color: "var(--ink)" }}>{result.correct}/{TOTAL_Q} صحيح</h3>
      <p className="text-xs text-gray-500 mb-3">أعلى مستوى وصلت له: Lv.{Math.max(...levelsRef.current)}</p>
      <div className="rounded-xl p-4 my-4" style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>نقاط الجلسة</div>
        <div className="text-3xl font-black" style={{ color: "var(--brand)" }}>{result.sessionScore.toLocaleString("ar-EG")}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>IQ الكلي: <strong>{result.newIQ}</strong></div>
      </div>
      <GameFeedback
        subject="languages"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#D85A30,#EF9F27)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100"
          style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>✅ {correct}</span>
      </div>
      <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs mb-2 font-bold" style={{ color: "var(--ink-3)" }}>{q?.dir === "ar→en" ? "عربي ← إنجليزي" : "إنجليزي ← عربي"}</p>
        <p className="text-4xl font-black" style={{ color: "var(--ink)" }}>{q?.word}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map(ch => {
          const isSel = selected === ch, isAns = selected !== null && ch === q.answer, isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => answer(ch)} disabled={!!selected}
              className="py-4 rounded-2xl text-base font-black transition-all active:scale-95"
              style={{
                minHeight: 64,
                background: isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--surface)",
                color: (isAns || isWrong) ? "#fff" : "var(--ink)",
                border: `2px solid ${isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--border)"}`
              }}>
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Error Sniper Game ─────────────────────────────────────────────────── */
function ErrorSniperGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("languages"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<SnipeQ | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | "none" | "__timeout__" | null>(null);
  const [correct, setCorrect] = useState(0);
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  const [timerPct, setTimerPct] = useState(100);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);

  const clear = () => { if (timerRef.current) clearInterval(timerRef.current); if (advRef.current) clearTimeout(advRef.current); };

  const nextQ = useCallback((idx: number) => {
    if (idx >= TOTAL_Q) {
      const avgLevel = levelsRef.current.reduce((a, b) => a + b, 0) / levelsRef.current.length;
      const gameResult: GameResult = {
        correct: correctRef.current,
        total: TOTAL_Q,
        totalTimeMs: totalMsRef.current,
        avgLevel,
        maxStreak: maxStreakRef.current,
        difficulty: levelToDifficulty(levelRef.current),
      };
      const res = updateIQ("languages", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genSnipeQ(cur, usedQuestionsRef.current));
    setSelected(null);
    setHint("");
    setQIdx(idx);
    setTimerPct(100);
    
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      setTimerPct(Math.max(0, 100 - (elapsed / (secs * 1000)) * 100));
      if (elapsed >= secs * 1000) {
        clearInterval(timerRef.current!);
        vibrate("wrong");
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
        setSelected("__timeout__");
        const now = Date.now();
        totalMsRef.current += now - tStartRef.current;
        tStartRef.current = now;
        streakRef.current = 0;
        advRef.current = setTimeout(() => nextQ(idx + 1), 1200);
      }
    }, 100);
    tStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  const start = () => {
    clear();
    usedQuestionsRef.current.clear();
    correctRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    levelsRef.current = [];
    totalMsRef.current = 0;
    const startLvl = difficultyToStartLevel(diff);
    levelRef.current = startLvl;
    setLevel(startLvl);
    setCorrect(0);
    setResult(null);
    setState("playing");
    nextQ(0);
  };

  const pick = useCallback((choice: number | "none") => {
    if (selected !== null) return;
    clear();
    setSelected(choice);
    const now = Date.now();
    totalMsRef.current += now - tStartRef.current;
    
    const curLevel = levelRef.current;
    const secs = levelToTimer(curLevel, BASE_TIMERS);
    const timeUsedPct = (now - tStartRef.current) / (secs * 1000);
    
    const hasError = q?.wrongIdx !== null;
    const ok = hasError ? choice === q!.wrongIdx : choice === "none";
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC;
    setCorrect(newC);
    
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr;
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");
    setHint(q?.hint || "");

    // Adjust levels
    const prevLvl = levelRef.current;
    if (ok && timeUsedPct < 0.45 && levelRef.current < 10) {
      levelRef.current = Math.min(10, levelRef.current + 1);
      setLevel(levelRef.current);
      if (levelRef.current > prevLvl) {
        setLevelAnim(true);
        setTimeout(() => setLevelAnim(false), 800);
        vibrate("levelup");
      }
    } else if (!ok && levelRef.current > 1) {
      levelRef.current = Math.max(1, levelRef.current - 1);
      setLevel(levelRef.current);
    }

    advRef.current = setTimeout(() => nextQ(qIdx + 1), 1600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🎯</div>
      <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>اضغط الكلمة الخاطئة نحوياً في الجملة</p>
      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>أو اضغط "مفيش خطأ" إذا كانت الجملة سليمة</p>
      
      {!isAdaptive && (
        <div className="flex gap-2 justify-center mb-6">
          {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)} className="px-4 py-2 rounded-xl text-sm font-black"
              style={{ background: diff === d ? DIFF_COLOR[d] : "var(--surface-2)", color: diff === d ? "#fff" : "var(--ink-3)", border: `2px solid ${diff === d ? DIFF_COLOR[d] : "var(--border)"}` }}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
      )}
      {isAdaptive && (
        <p className="text-xs mb-5 font-bold" style={{ color: "var(--brand)" }}>
          تم تحديد الصعوبة تلقائياً: {DIFF_LABEL[diff]} ⚡
        </p>
      )}
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#D85A30,#EF9F27)" }}>ابدأ</button>
    </div>
  );

  if (state === "result" && result) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 52 }}>{result.correct >= 8 ? "🏆" : result.correct >= 5 ? "⭐" : "💪"}</div>
      <h3 className="text-2xl font-black mb-1" style={{ color: "var(--ink)" }}>{result.correct}/{TOTAL_Q} صحيح</h3>
      <p className="text-xs text-gray-500 mb-3">أعلى مستوى وصلت له: Lv.{Math.max(...levelsRef.current)}</p>
      <div className="rounded-xl p-4 my-4" style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>نقاط الجلسة</div>
        <div className="text-3xl font-black" style={{ color: "var(--brand)" }}>{result.sessionScore.toLocaleString("ar-EG")}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>IQ الكلي: <strong>{result.newIQ}</strong></div>
      </div>
      <GameFeedback
        subject="languages"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#D85A30,#EF9F27)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>
      <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold mb-3" style={{ color: "var(--ink-3)" }}>اضغط الكلمة الخاطئة:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {q?.words.map((w, i) => {
            const isSel = selected === i;
            const isWrong = selected !== null && i === q.wrongIdx;
            const isCorrectSel = isSel && i === q.wrongIdx;
            const isBadSel = isSel && i !== q.wrongIdx;
            
            return (
              <button key={i} onClick={() => pick(i)} disabled={selected !== null}
                className="px-4 rounded-xl font-black text-base transition-all active:scale-95"
                style={{
                  minHeight: 48,
                  background: isCorrectSel ? "#1D9E75" : isBadSel ? "#D4537E" : isWrong && selected !== null ? "#1D9E75" : "var(--surface-2)",
                  color: (isCorrectSel || isBadSel || (isWrong && selected !== null)) ? "#fff" : "var(--ink)",
                  border: `2px solid ${isCorrectSel ? "#1D9E75" : isBadSel ? "#D4537E" : isWrong && selected !== null ? "#1D9E75" : "var(--border)"}`,
                }}>
                {w}
              </button>
            );
          })}
        </div>
        {hint && <p className="text-xs text-center mt-3 font-bold" style={{ color: "var(--ink-3)" }}>💡 {hint}</p>}
      </div>
      <button onClick={() => pick("none")} disabled={selected !== null}
        className="w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
        style={{
          background: selected === "none" ? (q?.wrongIdx === null ? "#1D9E75" : "#D4537E") : "var(--surface-2)",
          color: selected === "none" ? "#fff" : "var(--ink-3)",
          border: `2px solid ${selected === "none" ? (q?.wrongIdx === null ? "#1D9E75" : "#D4537E") : "var(--border)"}`,
        }}>
        مفيش خطأ — الجملة سليمة ✓
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function LanguagesEnvironment() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [tab, setTab] = useState<"duel" | "sniper">("duel");
  const [iqData, setIqData] = useState<IQData>(() => getIQData());
  const [isAdaptive, setIsAdaptive] = useState(false);

  useEffect(() => {
    fetchMeWithRetry(2, 100).then(me => setUser(me)).catch(() => {});
    
    // Fetch adaptive difficulty settings
    fetch("/api/student/iq")
      .then(res => res.json())
      .then(data => {
        if (data && data.isAdaptive) {
          setIsAdaptive(true);
        }
      })
      .catch(() => {});
  }, []);

  const refreshIQ = () => setIqData(getIQData());
  const skills = SUBJECT_SKILLS["languages"];

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Link href="/environments" className="flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ink-3)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              البيئات
            </Link>
            <span style={{ color: "var(--border-strong)" }}>›</span>
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>🗣️ اللغات</span>
            <div className="mr-auto flex items-center gap-2 flex-wrap">
              {(skills as (keyof typeof SKILL_LABELS)[]).map(sk => (
                <span key={sk} className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ background: SKILL_COLORS[sk] + "22", color: SKILL_COLORS[sk] }}>
                  {SKILL_LABELS[sk].split(" ").pop()} {iqData.skills[sk].score}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-6 p-1 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {([["duel", "⚔️ Word Duel"], ["sniper", "🎯 Error Sniper"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "duel" && <WordDuelGame key="duel" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
          {tab === "sniper" && <ErrorSniperGame key="sniper" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
