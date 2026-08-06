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

/* ─── Timeline Tap Data & Templates ─────────────────────────────────────── */
interface HistoryEvent {
  event: string;
  year: number; // Negative for BC, positive for AD
}

const HISTORY_EVENTS: HistoryEvent[] = [
  { event: "بناء الأهرامات بالجيزة", year: -2560 },
  { event: "حكم حمورابي في بابل وصياغة شريعته", year: -1750 },
  { event: "حكم رمسيس الثاني في مصر القديمة", year: -1279 },
  { event: "تأسيس مدينة روما القديمة", year: -753 },
  { event: "وفاة الإسكندر الأكبر في بابل", year: -323 },
  { event: "اغتيال يوليوس قيصر في مجلس الشيوخ", year: -44 },
  { event: "ميلاد السيد المسيح عليه السلام", year: 1 },
  { event: "هجرة النبي محمد إلى المدينة المنورة", year: 622 },
  { event: "فتح مكة المكرمة", year: 630 },
  { event: "معركة القادسية ضد الفرس بقيادة سعد", year: 636 },
  { event: "تأسيس الدولة الأموية في دمشق", year: 661 },
  { event: "تأسيس الدولة العباسية في بغداد", year: 750 },
  { event: "تأسيس بيت الحكمة في بغداد", year: 830 },
  { event: "معركة ملاذكرد بقيادة ألب أرسلان", year: 1071 },
  { event: "انطلاق الحملة الصليبية الأولى", year: 1095 },
  { event: "صلاح الدين الأيوبي يحرر القدس", year: 1187 },
  { event: "حصار بغداد وسقوط الخلافة العباسية", year: 1258 },
  { event: "معركة عين جالوت بقيادة قطز", year: 1260 },
  { event: "فتح القسطنطينية بقيادة محمد الفاتح", year: 1453 },
  { event: "سقوط غرناطة ونهاية الأندلس", year: 1492 },
  { event: "اكتشاف كولومبوس لقارة أمريكا", year: 1492 },
  { event: "الفتح العثماني لمصر والشام مع سليم الأول", year: 1517 },
  { event: "صدور معاهدة وستفاليا لسلام أوروبا", year: 1648 },
  { event: "انطلاق الثورة الصناعية في بريطانيا", year: 1760 },
  { event: "الثورة الأمريكية وإعلان الاستقلال", year: 1776 },
  { event: "اندلاع الثورة الفرنسية وسقوط الباستيل", year: 1789 },
  { event: "الحملة الفرنسية على مصر بقيادة نابليون", year: 1798 },
  { event: "اندلاع الحرب العالمية الأولى", year: 1914 },
  { event: "اندلاع الحرب العالمية الثانية", year: 1939 },
  { event: "تأسيس هيئة الأمم المتحدة", year: 1945 }
];

// Generate dynamic timeline sorting based on level
function genTimeline(level: number, usedQuestions: Set<string>) {
  const numEvents = level <= 3 ? 3 : level <= 7 ? 4 : 5;
  
  let chosen: HistoryEvent[] = [];
  let key = "";
  
  let attempts = 0;
  do {
    // Pick unique random events
    const shuffledPool = [...HISTORY_EVENTS].sort(() => Math.random() - 0.5);
    chosen = shuffledPool.slice(0, numEvents);
    // Sort chosen events by year to create a unique identifier
    key = chosen.map(e => e.event).sort().join("|");
    attempts++;
  } while (usedQuestions.has(key) && attempts < 100);
  
  usedQuestions.add(key);

  // Original chronologically sorted order
  const sorted = [...chosen].sort((a, b) => a.year - b.year);
  
  // Shuffled version for user to sort
  const shuffled = [...chosen].sort(() => Math.random() - 0.5);
  
  // Map years in order matching shuffled elements
  const years = shuffled.map(s => s.year);

  return {
    shuffled: shuffled.map(s => s.event),
    correctOrder: shuffled.map(s => sorted.findIndex(o => o.event === s.event)),
    years,
    original: sorted.map(s => s.event)
  };
}

/* ─── Who Said It Data & Templates ──────────────────────────────────────── */
interface QuoteQ {
  quote: string;
  answer: string;
  choices: string[];
  category: "easy" | "medium" | "hard";
}

const QUOTES_POOL: QuoteQ[] = [
  { quote: "أنا لا أفشل. أنا فقط أجد 10,000 طريقة لا تعمل.", answer: "توماس إيديسون", choices: ["توماس إيديسون", "ألبيرت أينشتاين", "إسحاق نيوتن", "تشارلز داروين"], category: "easy" },
  { quote: "نحن نكون ما نكرر فعله. التميز إذن ليس فعلاً بل عادة.", answer: "أرسطو", choices: ["أرسطو", "أفلاطون", "سقراط", "ديكارت"], category: "easy" },
  { quote: "أنا أفكر، إذن أنا موجود.", answer: "رينيه ديكارت", choices: ["رينيه ديكارت", "جون لوك", "فرانسيس بيكون", "كانت"], category: "easy" },
  { quote: "اعرف عدوك واعرف نفسك، تفز في مئة معركة.", answer: "صن تزو", choices: ["صن تزو", "يوليوس قيصر", "نابليون بونابرت", "الإسكندر الأكبر"], category: "easy" },
  { quote: "العين بالعين تجعل العالم بأسره أعمى.", answer: "المهاتما غاندي", choices: ["المهاتما غاندي", "نيلسون مانديلا", "مارتن لوثر كينغ", "الداي لاما"], category: "easy" },
  { quote: "الشعوب التي لا تقرأ تاريخها محكوم عليها بتكراره.", answer: "إدموند بيرك", choices: ["إدموند بيرك", "ابن خلدون", "كارل ماركس", "هيغل"], category: "easy" },
  { quote: "ليس الشجاع من لا يشعر بالخوف، بل من ينتصر عليه.", answer: "نيلسون مانديلا", choices: ["نيلسون مانديلا", "غاندي", "كاسترو", "مارتن لوثر"], category: "medium" },
  { quote: "إذا أردت أن تعيش حياة سعيدة، فاربطها بهدف لا بأشخاص.", answer: "ألبيرت أينشتاين", choices: ["ألبيرت أينشتاين", "سيغموند فرويد", "فريدريك نيتشه", "سارتر"], category: "medium" },
  { quote: "أنا لا أوافق على ما تقول، لكني سأدافع حتى الموت عن حقك في قوله.", answer: "فولتير", choices: ["فولتير", "جان جاك روسو", "جون لوك", "مونتسكيو"], category: "medium" },
  { quote: "الديمقراطية هي حكم الشعب، بواسطة الشعب، ومن أجل الشعب.", answer: "أبراهام لينكولن", choices: ["أبراهام لينكولن", "جورج واشنطن", "توماس جيفرسون", "روزفلت"], category: "medium" },
  { quote: "التاريخ يعيد نفسه، في المرة الأولى كمأساة، وفي الثانية كمهزلة.", answer: "كارل ماركس", choices: ["كارل ماركس", "فريدريك هيغل", "نيتشه", "شوبنهاور"], category: "hard" },
  { quote: "الحضارات لا تموت قتلاً، بل تنتحر ذاتياً.", answer: "أرنولد توينبي", choices: ["أرنولد توينبي", "ابن خلدون", "سقراط", "إدوارد سعيد"], category: "hard" },
  { quote: "العقلاء يتكيفون مع العالم؛ غير العقلاء يصرون على تكييف العالم معهم.", answer: "جورج برنارد شو", choices: ["جورج برنارد شو", "أوسكار وايلد", "تشارلز ديكنز", "مارك توين"], category: "hard" }
];

// Generate quote question based on level
function genQuoteQ(level: number, usedQuestions: Set<string>): QuoteQ {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = QUOTES_POOL.filter(q => q.category === cat);
  if (pool.length === 0) pool = QUOTES_POOL;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `quote-${chosen.quote}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `quote-${chosen.quote}`;
    attempts++;
  }
  usedQuestions.add(key);

  const choices = [...chosen.choices].sort(() => Math.random() - 0.5);

  return { ...chosen, choices };
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TOTAL_Q = 10;
const BASE_TIMERS = { easy: 24, medium: 18, hard: 12 };

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

/* ─── Timeline Tap Game ─────────────────────────────────────────────────── */
function TimelineTapGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("history"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [timeline, setTimeline] = useState<ReturnType<typeof genTimeline> | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timerPct, setTimerPct] = useState(100);
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);

  const clear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  };

  const nextRound = useCallback((idx: number) => {
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
      const res = updateIQ("history", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setTimeline(genTimeline(cur, usedQuestionsRef.current));
    setTaps([]);
    setShowResult(false);
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
        setShowResult(true);
        const now = Date.now();
        totalMsRef.current += now - tStartRef.current;
        tStartRef.current = now;
        streakRef.current = 0;
        advRef.current = setTimeout(() => nextRound(idx + 1), 1600);
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
    nextRound(0);
  };

  const tapEvent = (idx: number) => {
    if (taps.includes(idx) || showResult) return;
    const newTaps = [...taps, idx];
    setTaps(newTaps);
    
    if (newTaps.length === timeline!.shuffled.length) {
      clear();
      // Validate order
      const sortedByYear = newTaps.map(i => ({
        i,
        year: timeline!.years[i]
      })).sort((a, b) => a.year - b.year).map(x => x.i);
      
      const isCorrect = JSON.stringify(newTaps) === JSON.stringify(sortedByYear);
      
      const now = Date.now();
      totalMsRef.current += now - tStartRef.current;
      
      const curLevel = levelRef.current;
      const secs = levelToTimer(curLevel, BASE_TIMERS);
      const timeUsedPct = (now - tStartRef.current) / (secs * 1000);
      
      const newC = correctRef.current + (isCorrect ? 1 : 0);
      correctRef.current = newC;
      setCorrect(newC);
      
      const newStr = isCorrect ? streakRef.current + 1 : 0;
      streakRef.current = newStr;
      maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
      vibrate(isCorrect ? (newStr >= 3 ? "streak" : "correct") : "wrong");
      setShowResult(true);

      // Adjust levels
      const prevLvl = levelRef.current;
      if (isCorrect && timeUsedPct < 0.45 && levelRef.current < 10) {
        levelRef.current = Math.min(10, levelRef.current + 1);
        setLevel(levelRef.current);
        if (levelRef.current > prevLvl) {
          setLevelAnim(true);
          setTimeout(() => setLevelAnim(false), 800);
          vibrate("levelup");
        }
      } else if (!isCorrect && levelRef.current > 1) {
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
      }

      advRef.current = setTimeout(() => nextRound(qIdx + 1), 1600);
    }
  };

  const resetTaps = () => setTaps([]);

  useEffect(() => () => { if (advRef.current) clearTimeout(advRef.current); }, []);

  const sortedCorrectOrder = timeline ? [...timeline.shuffled.keys()].sort((a, b) => timeline.years[a] - timeline.years[b]) : [];

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
      <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>رتّب الأحداث التاريخية من الأقدم للأحدث بالضغط عليها بالترتيب</p>
      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>المستوى يرتفع كلما كنت أسرع وأدق ⚡</p>
      
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
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#EF9F27,#D4537E)" }}>ابدأ</button>
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
        subject="history"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#EF9F27,#D4537E)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>
      <p className="text-sm font-bold mb-3 text-center" style={{ color: "var(--ink-3)" }}>اضغط الأحداث من الأقدم للأحدث:</p>
      <div className="flex flex-col gap-3 mb-4">
        {timeline?.shuffled.map((ev, i) => {
          const tapIdx = taps.indexOf(i);
          const isTapped = tapIdx !== -1;
          const isCorrectPos = showResult && sortedCorrectOrder[tapIdx] === i;
          const isWrongPos = showResult && isTapped && !isCorrectPos;
          
          return (
            <button key={i} onClick={() => tapEvent(i)} disabled={isTapped || showResult}
              className="w-full p-4 rounded-2xl text-right font-bold text-sm transition-all active:scale-98"
              style={{
                minHeight: 56,
                background: isCorrectPos ? "#1D9E75" : isWrongPos ? "#D4537E" : isTapped ? "var(--brand-soft)" : "var(--surface)",
                color: (isCorrectPos || isWrongPos) ? "#fff" : isTapped ? "var(--brand)" : "var(--ink)",
                border: `2px solid ${isCorrectPos ? "#1D9E75" : isWrongPos ? "#D4537E" : isTapped ? "var(--brand)" : "var(--border)"}`,
              }}>
              {isTapped && <span className="inline-block w-6 h-6 rounded-full text-center text-xs font-black leading-6 ml-2"
                style={{ background: isCorrectPos ? "#fff" : isWrongPos ? "#fff" : "var(--brand)", color: isCorrectPos ? "#1D9E75" : isWrongPos ? "#D4537E" : "#fff" }}>
                {tapIdx + 1}
              </span>}
              {ev}
            </button>
          );
        })}
      </div>
      {taps.length > 0 && !showResult && (
        <button onClick={resetTaps} className="w-full py-2 rounded-xl text-sm font-bold" style={{ color: "var(--ink-3)", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          إعادة الترتيب ↺
        </button>
      )}
    </div>
  );
}

/* ─── Who Said It Game ──────────────────────────────────────────────────── */
function WhoSaidItGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("history"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<QuoteQ | null>(null);
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

  const clear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  };

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
      const res = updateIQ("history", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genQuoteQ(cur, usedQuestionsRef.current));
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
    
    advRef.current = setTimeout(() => nextQ(qIdx + 1), 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>مَن قال هذه المقولة؟ اضغط الشخصية الصحيحة</p>
      
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
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#EF9F27,#D4537E)" }}>ابدأ</button>
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
        subject="history"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#EF9F27,#D4537E)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>
      <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold mb-3" style={{ color: "var(--ink-3)" }}>مَن قال:</p>
        <p className="text-lg font-bold leading-relaxed" style={{ color: "var(--ink)" }}>&quot;{q?.quote}&quot;</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map(ch => {
          const isSel = selected === ch, isAns = selected !== null && ch === q.answer, isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => answer(ch)} disabled={!!selected}
              className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
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

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function HistoryEnvironment() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [tab, setTab] = useState<"timeline" | "quotes">("timeline");
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
  const skills = SUBJECT_SKILLS["history"];

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
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>🏛️ التاريخ</span>
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
            {([["timeline", "📅 Timeline Tap"], ["quotes", "💬 Who Said It?"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "timeline" && <TimelineTapGame key="timeline" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
          {tab === "quotes" && <WhoSaidItGame key="quotes" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
