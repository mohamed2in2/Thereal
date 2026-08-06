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

/* ─── Flag Tap Data ─────────────────────────────────────────────────────── */
interface FlagQ {
  flag: string;
  answer: string;
  choices: string[];
  category: "easy" | "medium" | "hard";
}

const FLAGS_POOL: FlagQ[] = [
  { flag: "🇪🇬", answer: "مصر", choices: ["مصر", "ليبيا", "السودان", "تونس"], category: "easy" },
  { flag: "🇸🇦", answer: "السعودية", choices: ["السعودية", "الإمارات", "الكويت", "البحرين"], category: "easy" },
  { flag: "🇫🇷", answer: "فرنسا", choices: ["فرنسا", "بلجيكا", "إيطاليا", "هولندا"], category: "easy" },
  { flag: "🇩🇪", answer: "ألمانيا", choices: ["ألمانيا", "النمسا", "سويسرا", "بلجيكا"], category: "easy" },
  { flag: "🇺🇸", answer: "أمريكا", choices: ["أمريكا", "كندا", "أستراليا", "المملكة المتحدة"], category: "easy" },
  { flag: "🇬🇧", answer: "المملكة المتحدة", choices: ["المملكة المتحدة", "أيرلندا", "كندا", "أستراليا"], category: "easy" },
  { flag: "🇨🇳", answer: "الصين", choices: ["الصين", "اليابان", "كوريا الجنوبية", "فيتنام"], category: "easy" },
  { flag: "🇯🇵", answer: "اليابان", choices: ["اليابان", "الصين", "كوريا", "تايوان"], category: "easy" },
  { flag: "🇧🇷", answer: "البرازيل", choices: ["البرازيل", "الأرجنتين", "كولومبيا", "بيرو"], category: "easy" },
  { flag: "🇷🇺", answer: "روسيا", choices: ["روسيا", "بيلاروسيا", "أوكرانيا", "بولندا"], category: "easy" },
  { flag: "🇲🇦", answer: "المغرب", choices: ["المغرب", "الجزائر", "تونس", "موريتانيا"], category: "easy" },
  { flag: "🇹🇷", answer: "تركيا", choices: ["تركيا", "إيران", "أذربيجان", "جورجيا"], category: "easy" },
  { flag: "🇮🇹", answer: "إيطاليا", choices: ["إيطاليا", "إسبانيا", "فرنسا", "اليونان"], category: "easy" },
  { flag: "🇪🇸", answer: "إسبانيا", choices: ["إسبانيا", "البرتغال", "فرنسا", "إيطاليا"], category: "easy" },
  { flag: "🇳🇱", answer: "هولندا", choices: ["هولندا", "لوكسمبورغ", "بلجيكا", "الدنمارك"], category: "medium" },
  { flag: "🇵🇱", answer: "بولندا", choices: ["بولندا", "جمهورية التشيك", "سلوفاكيا", "المجر"], category: "medium" },
  { flag: "🇦🇷", answer: "الأرجنتين", choices: ["الأرجنتين", "تشيلي", "أوروغواي", "باراغواي"], category: "medium" },
  { flag: "🇿🇦", answer: "جنوب أفريقيا", choices: ["جنوب أفريقيا", "زيمبابوي", "موزمبيق", "ناميبيا"], category: "medium" },
  { flag: "🇰🇷", answer: "كوريا الجنوبية", choices: ["كوريا الجنوبية", "كوريا الشمالية", "اليابان", "تايوان"], category: "medium" },
  { flag: "🇮🇩", answer: "إندونيسيا", choices: ["إندونيسيا", "ماليزيا", "الفلبين", "تايلاند"], category: "medium" },
  { flag: "🇵🇰", answer: "باكستان", choices: ["باكستان", "أفغانستان", "الهند", "بنغلاديش"], category: "medium" },
  { flag: "🇳🇬", answer: "نيجيريا", choices: ["نيجيريا", "غانا", "كينيا", "إثيوبيا"], category: "medium" },
  { flag: "🇺🇦", answer: "أوكرانيا", choices: ["أوكرانيا", "بيلاروسيا", "مولدوفا", "سلوفاكيا"], category: "medium" },
  { flag: "🇸🇪", answer: "السويد", choices: ["السويد", "النرويج", "الدنمارك", "فنلندا"], category: "medium" },
  { flag: "🇵🇹", answer: "البرتغال", choices: ["البرتغال", "إسبانيا", "المغرب", "كابو فيردي"], category: "medium" },
  { flag: "🇲🇳", answer: "منغوليا", choices: ["منغوليا", "كازاخستان", "أوزبكستان", "طاجيكستان"], category: "hard" },
  { flag: "🇱🇻", answer: "لاتفيا", choices: ["لاتفيا", "ليتوانيا", "إستونيا", "فنلندا"], category: "hard" },
  { flag: "🇸🇮", answer: "سلوفينيا", choices: ["سلوفينيا", "كرواتيا", "سلوفاكيا", "صربيا"], category: "hard" },
  { flag: "🇲🇩", answer: "مولدوفا", choices: ["مولدوفا", "رومانيا", "أوكرانيا", "بيلاروسيا"], category: "hard" },
  { flag: "🇧🇫", answer: "بوركينا فاسو", choices: ["بوركينا فاسو", "مالي", "غينيا", "ساحل العاج"], category: "hard" },
  { flag: "🇲🇿", answer: "موزمبيق", choices: ["موزمبيق", "تنزانيا", "مالاوي", "زامبيا"], category: "hard" },
  { flag: "🇹🇲", answer: "تركمانستان", choices: ["تركمانستان", "أوزبكستان", "كازاخستان", "قيرغيزستان"], category: "hard" }
];

function genFlagQ(level: number, usedQuestions: Set<string>): FlagQ {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = FLAGS_POOL.filter(f => f.category === cat);
  if (pool.length === 0) pool = FLAGS_POOL;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `flag-${chosen.flag}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `flag-${chosen.flag}`;
    attempts++;
  }
  usedQuestions.add(key);

  const choices = [...chosen.choices].sort(() => Math.random() - 0.5);

  return { ...chosen, choices };
}

/* ─── Pin The Country Data ──────────────────────────────────────────────── */
interface PinQ {
  clue: string;
  answer: string;
  choices: string[];
  hint: string;
  category: "easy" | "medium" | "hard";
}

const PIN_POOL: PinQ[] = [
  { clue: "أكبر دولة في أفريقيا من حيث المساحة", answer: "الجزائر", choices: ["الجزائر", "السودان", "ليبيا", "موريتانيا"], hint: "تقع في شمال أفريقيا وعاصمتها الجزائر", category: "easy" },
  { clue: "الدولة التي تحتضن أهرامات الجيزة ونهر النيل العظيم", answer: "مصر", choices: ["مصر", "ليبيا", "تونس", "المغرب"], hint: "تطل على البحر الأبيض المتوسط والأحمر", category: "easy" },
  { clue: "أكبر دولة في العالم من حيث المساحة الجغرافية", answer: "روسيا", choices: ["روسيا", "كندا", "الصين", "أمريكا"], hint: "تمتد عبر قارتي أوروبا وآسيا", category: "easy" },
  { clue: "الدولة التي يقع فيها برج إيفل الشهير", answer: "فرنسا", choices: ["فرنسا", "بلجيكا", "إيطاليا", "هولندا"], hint: "عاصمتها باريس بلد الموضة", category: "easy" },
  { clue: "يقع فيها ضريح تاج محل التاريخي", answer: "الهند", choices: ["الهند", "باكستان", "بنغلاديش", "نيبال"], hint: "دولة في جنوب آسيا عاصمتها نيودلهي", category: "easy" },
  { clue: "أكبر دولة في أمريكا اللاتينية من حيث المساحة والسكان", answer: "البرازيل", choices: ["البرازيل", "المكسيك", "الأرجنتين", "كولومبيا"], hint: "تتحدث البرتغالية وعاصمتها برازيليا", category: "easy" },
  { clue: "دولة أوروبية تشتهر بطواحين الهواء وزهور الزنبق", answer: "هولندا", choices: ["هولندا", "بلجيكا", "الدنمارك", "لوكسمبورغ"], hint: "عاصمتها أمستردام", category: "easy" },
  { clue: "الدولة الأعلى في العالم فوق مستوى سطح البحر وتضم هضبة التبت", answer: "الصين", choices: ["الصين", "الهند", "نيبال", "منغوليا"], hint: "عاصمتها بكين وتضم سور الصين العظيم", category: "medium" },
  { clue: "الدولة التي تشترك مع أكبر عدد من الدول المجاورة في الحدود (14 دولة)", answer: "الصين", choices: ["الصين", "روسيا", "البرازيل", "ألمانيا"], hint: "تقع في شرق قارة آسيا", category: "medium" },
  { clue: "دولة تقع جغرافياً بين قارتين: نصفها في أوروبا ونصفها في آسيا", answer: "تركيا", choices: ["تركيا", "روسيا", "مصر", "جورجيا"], hint: "عاصمتها أنقرة وتضم مدينة إسطنبول", category: "medium" },
  { clue: "البلد الذي يمتلك أعلى متوسط عمر متوقع للسكان في العالم وتتميز بنظام غذائي صحي", answer: "اليابان", choices: ["اليابان", "سويسرا", "سنغافورة", "النرويج"], hint: "مجموعة جزر في المحيط الهادئ شرق آسيا", category: "medium" },
  { clue: "أصغر دولة مستقلة في العالم من حيث المساحة والسكان", answer: "الفاتيكان", choices: ["الفاتيكان", "موناكو", "سان مارينو", "ليختنشتاين"], hint: "تقع بالكامل داخل العاصمة الإيطالية روما", category: "hard" },
  { clue: "الدولة الوحيدة في العالم التي تحيط بها بالكامل دولة واحدة أخرى فقط (جنوب أفريقيا)", answer: "ليسوتو", choices: ["ليسوتو", "سان مارينو", "الفاتيكان", "سوازيلاند"], hint: "مملكة جبلية مغلقة في جنوب القارة السمراء", category: "hard" },
  { clue: "البلد الذي يضم أعمق بحيرة مياه عذبة في العالم (بحيرة بايكال)", answer: "روسيا", choices: ["روسيا", "كندا", "الصين", "منغوليا"], hint: "تقع البحيرة في منطقة سيبيريا", category: "hard" },
  { clue: "الدولة التي اكتشفت فيها حبوب البن وأول من شرب القهوة تاريخياً", answer: "إثيوبيا", choices: ["إثيوبيا", "اليمن", "البرازيل", "كولومبيا"], hint: "دولة في القرن الأفريقي عاصمتها أديس أبابا", category: "hard" }
];

function genPinQ(level: number, usedQuestions: Set<string>): PinQ {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = PIN_POOL.filter(p => p.category === cat);
  if (pool.length === 0) pool = PIN_POOL;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `pin-${chosen.clue}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `pin-${chosen.clue}`;
    attempts++;
  }
  usedQuestions.add(key);

  const choices = [...chosen.choices].sort(() => Math.random() - 0.5);

  return { ...chosen, choices };
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TOTAL_Q = 10;
const BASE_TIMERS = { easy: 15, medium: 12, hard: 8 };

const DIFF_LABEL: Record<Difficulty, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const DIFF_COLOR: Record<Difficulty, string> = { easy: "#1D9E75", medium: "#EF9F27", hard: "#D4537E" };

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

/* ─── Dynamic MCQ Engine ────────────────────────────────────────────────── */
function DynamicMCQEngine<T extends { answer: string; choices: string[] }>({
  subject, genQ, renderQ, onFinish, accentColor, isAdaptive,
}: {
  subject: string;
  genQ: (level: number, usedQuestions: Set<string>) => T;
  renderQ: (q: T) => React.ReactNode;
  onFinish: () => void;
  accentColor: string;
  isAdaptive: boolean;
}) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty(subject));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<T | null>(null);
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
      const res = updateIQ(subject, gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genQ(cur, usedQuestionsRef.current));
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
  }, [subject, genQ, onFinish]);

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
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌍</div>
      <p className="text-sm mb-4" style={{ color: "var(--ink-3)" }}>{TOTAL_Q} أسئلة · يتعدل الوقت والمستوى تلقائياً حسب سرعتك ⚡</p>
      
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
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: accentColor }}>ابدأ</button>
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
        subject="geography"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: accentColor }}>مرة أخرى</button>
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
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>
      <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {q && renderQ(q)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map((ch) => {
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
export default function GeographyEnvironment() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [tab, setTab] = useState<"flags" | "pin">("flags");
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
  const skills = SUBJECT_SKILLS["geography"];

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
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>🌍 الجغرافيا</span>
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
            {([["flags", "🚩 Flag Tap"], ["pin", "📍 Pin Country"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "flags" && (
            <DynamicMCQEngine<FlagQ> key="flags" subject="geography"
              genQ={genFlagQ}
              renderQ={q => (
                <div>
                  <p className="text-8xl mb-2">{q.flag}</p>
                  <p className="text-sm font-bold" style={{ color: "var(--ink-3)" }}>هذا علم أي دولة؟</p>
                </div>
              )}
              onFinish={refreshIQ}
              accentColor="linear-gradient(135deg,#EF9F27,#534AB7)"
              isAdaptive={isAdaptive}
            />
          )}
          {tab === "pin" && (
            <DynamicMCQEngine<PinQ> key="pin" subject="geography"
              genQ={genPinQ}
              renderQ={q => (
                <div>
                  <p className="text-sm font-bold mb-2" style={{ color: "var(--ink-3)" }}>أي دولة هذه؟</p>
                  <p className="text-base font-bold leading-relaxed" style={{ color: "var(--ink)" }}>{q.clue}</p>
                  {q.hint && <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>💡 تلميح: {q.hint}</p>}
                </div>
              )}
              onFinish={refreshIQ}
              accentColor="linear-gradient(135deg,#534AB7,#1D9E75)"
              isAdaptive={isAdaptive}
            />
          )}
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
