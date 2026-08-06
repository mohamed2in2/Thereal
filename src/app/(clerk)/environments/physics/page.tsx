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

/* ─── Circuit Tap Data & Templates ───────────────────────────────────────── */
interface CircuitTemplate {
  id: string;
  description: string;
  circuit: string;
  missingRole: string;
  answer: string;
  choices: string[];
  explanation: string;
  category: "easy" | "medium" | "hard";
}

const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  { id: "c1", description: "دائرة بسيطة: بطارية + موصل + ؟ = ضوء", circuit: "🔋 ──── 🔌 ──── ؟ ──── 🔋", missingRole: "ما هو العنصر الناقص المضيء؟", answer: "مصباح 💡", choices: ["مصباح 💡", "مقاومة ⬡", "مكثف ⊣", "قاطع 🔲"], explanation: "المصباح يحوّل الطاقة الكهربائية إلى ضوء وحرارة", category: "easy" },
  { id: "c2", description: "دائرة تحتاج عنصراً لتخزين الشحنة والعمل كبطارية مؤقتة", circuit: "🔋 ──── ؟ ──── 🔋", missingRole: "ما الذي يخزن الشحنة؟", answer: "مكثف ⊣", choices: ["مكثف ⊣", "مقاومة ⬡", "مصباح 💡", "ملف 🔄"], explanation: "المكثف يخزن الشحنة الكهربائية في مجال كهربائي", category: "easy" },
  { id: "c3", description: "تريد تقليل شدة التيار في الدائرة لحماية المصباح من الاحتراق", circuit: "🔋 ──── ؟ ──── 💡 ──── 🔋", missingRole: "ما الذي يُقلل التيار؟", answer: "مقاومة ⬡", choices: ["مقاومة ⬡", "مكثف ⊣", "بطارية 🔋", "مصباح 💡"], explanation: "المقاومة تحدّ من تدفق التيار وفق قانون أوم: I=V/R", category: "easy" },
  { id: "c4", description: "تريد قطع التيار عن الدائرة يدوياً بكل سهولة وسلامة", circuit: "🔋 ──── ؟ ──── 💡 ──── 🔋", missingRole: "ما الذي يقطع التيار؟", answer: "مفتاح 🔲", choices: ["مفتاح 🔲", "مقاومة ⬡", "مكثف ⊣", "ملف 🔄"], explanation: "المفتاح يفتح أو يغلق الدائرة الكهربائية", category: "easy" },
  { id: "c5", description: "تريد إنتاج مجال مغناطيسي قوي عند مرور التيار الكهربائي", circuit: "🔋 ──── ؟ ──── 🔋", missingRole: "ما الذي ينتج مجالاً مغناطيسياً؟", answer: "ملف 🔄", choices: ["ملف 🔄", "مقاومة ⬡", "مكثف ⊣", "مصباح 💡"], explanation: "الملف (محرّض) يُنتج مجالاً مغناطيسياً عند مرور تيار", category: "easy" },
  { id: "c6", description: "دائرة تيار متردد AC — تريد تحويل الجهد المتناوب إلى تيار مستمر DC", circuit: "🔌AC ──── ؟ ──── 🔋DC", missingRole: "ما الذي يحوّل AC إلى DC؟", answer: "مُقوّم (Rectifier) ⇒", choices: ["مُقوّم (Rectifier) ⇒", "محوّل (Transformer) ≈≈", "مكثف ⊣", "ملف 🔄"], explanation: "المُقوّم (الدايود) يمرر التيار باتجاه واحد ليحوله لمستمر", category: "medium" },
  { id: "c7", description: "تريد زيادة جهد تيار متردد AC من 220V إلى 11000V لنقله لمسافات بعيدة", circuit: "🔌 220V ──── ؟ ──── 11000V", missingRole: "ما الذي يرفع الجهد؟", answer: "محوّل رافع ≈≈↑", choices: ["محوّل رافع ≈≈↑", "محوّل خافض ≈≈↓", "مُقوّم ⇒", "مكثف ⊣"], explanation: "المحوّل الرافع يزيد الجهد على حساب التيار", category: "medium" },
  { id: "c8", description: "دائرة رنين تيار متردد (RLC) — متى تتساوى الممانعة الحثية والممانعة السعوية؟", circuit: "R ──── L ──── C ──── V", missingRole: "الشرط الأساسي للرنين هو:", answer: "XL = XC", choices: ["XL = XC", "XL > XC", "XL < XC", "R = 0"], explanation: "عند الرنين تلغى الممانعات السعوية والحثية وتبقى المقاومة الأومية فقط", category: "medium" },
  { id: "c9", description: "قانون كيرشهوف الأول للتيارات يتأسس على قانون:", circuit: "Σ I_in = Σ I_out", missingRole: "ما القانون الفيزيائي الذي يمثله؟", answer: "حفظ الشحنة الكهربائية", choices: ["حفظ الشحنة الكهربائية", "حفظ الطاقة", "حفظ الزخم", "قانون كولوم"], explanation: "مجموع التيارات الداخلة لعقدة يساوي الخارجة منها (حفظ الشحنة)", category: "medium" },
  { id: "c10", description: "بوابة منطقية تعطي مخرجاً يساوي 1 فقط عندما تكون جميع المدخلات 0", circuit: "A ──┐\n      ؟ ── Y (Y=1 if A=0, B=0)\nB ──┘", missingRole: "ما هي البوابة المنطقية؟", answer: "بوابة NOR ⊶", choices: ["بوابة NOR ⊶", "بوابة NAND ⊷", "بوابة OR ≻", "بوابة AND ⊐"], explanation: "بوابة NOR تعكس بوابة OR، فتعطي 1 فقط عندما يكون كلاهما صفر", category: "hard" },
  { id: "c11", description: "ترانزيستور NPN — عند حقن تيار صغير في القاعدة (Base) يحدث:", circuit: "Base ─►─ NPN ─►─ Collector", missingRole: "ما النتيجة على المجمع؟", answer: "يمر تيار كبير من المجمع للباعث", choices: ["يمر تيار كبير من المجمع للباعث", "ينقطع التيار تماماً", "يمر تيار عكسي", "تحترق الوصلة الثنائية"], explanation: "يعمل الترانزيستور كمضخم تيار ومفتاح إلكتروني سريع", category: "hard" },
  { id: "c12", description: "بوابة NAND المنطقية — متى يكون خرج البوابة مساوياً للصفر؟", circuit: "A ──┐\n      NAND ── Y (Y=0)\nB ──┘", missingRole: "المدخلات الصحيحة هي:", answer: "A=1 و B=1 معاً", choices: ["A=1 و B=1 معاً", "A=0 و B=0 معاً", "A=1 و B=0", "A=0 و B=1"], explanation: "بوابة NAND تعطي صفراً فقط عندما تكون جميع المدخلات 1", category: "hard" }
];

// Generate circuit question by level (1-10) with duplicate prevention
function genCircuitQ(level: number, usedQuestions: Set<string>) {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = CIRCUIT_TEMPLATES.filter(c => c.category === cat);
  if (pool.length === 0) pool = CIRCUIT_TEMPLATES;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `circuit-${chosen.id}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `circuit-${chosen.id}`;
    attempts++;
  }
  usedQuestions.add(key);

  // Randomize choices
  const choices = [...chosen.choices].sort(() => Math.random() - 0.5);

  return {
    description: chosen.description,
    circuit: chosen.circuit,
    missingRole: chosen.missingRole,
    answer: chosen.answer,
    choices,
    explanation: chosen.explanation
  };
}

/* ─── Trajectory Angle Picker Clues ──────────────────────────────────────── */
interface AngleScenario {
  id: string;
  label: string;
  targetAngle: number;
  hint: string;
  category: "easy" | "medium" | "hard";
}

const ANGLE_SCENARIOS: AngleScenario[] = [
  { id: "a1", label: "أطلق قذيفة لتصل إلى أقصى مدى أفقي ممكن في الفراغ", targetAngle: 45, hint: "زاوية 45 درجة تعطي أقصى مدى أفقي للمقذوف", category: "easy" },
  { id: "a2", label: "أطلق صاروخاً شبه عمودي ليصل إلى أعلى ارتفاع ممكن مع مدى قصير", targetAngle: 75, hint: "الزوايا القريبة من 90 درجة تعطي أقصى ارتفاع رأسي", category: "easy" },
  { id: "a3", label: "أطلق قذيفة بزاوية منخفضة لتسير بسرعة ومسار مسطح جداً", targetAngle: 20, hint: "الزوايا الصغيرة تعطي مسارات منخفضة وسريعة", category: "easy" },
  { id: "a4", label: "زاوية إطلاق متممة لزاوية 30 درجة تعطي نفس المدى الأفقي تماماً", targetAngle: 60, hint: "الزاويتان اللتان مجموعهما 90 درجة تعطيان نفس المدى الأفقي", category: "medium" },
  { id: "a5", label: "الزاوية التي تجعل ذروة ارتفاع المقذوف تساوي نصف مداه الأفقي تماماً", targetAngle: 63, hint: "tan(θ) = 2 → θ ≈ 63 درجة", category: "medium" },
  { id: "a6", label: "أطلق مقذوفاً بزاوية تعطي مدى يعادل نصف المدى الأقصى (الزاوية الصغرى)", targetAngle: 15, hint: "sin(2θ) = 0.5 → 2θ = 30 → θ = 15 درجة", category: "medium" },
  { id: "a7", label: "زاوية إطلاق متممة لزاوية 15 درجة تعطي نفس المدى الأفقي", targetAngle: 75, hint: "الزاويتان اللتان مجموعهما 90 درجة تعطيان نفس المدى", category: "medium" },
  { id: "a8", label: "مدفع على هضبة مرتفعة عن الأرض — ما الزاوية المثالية للمدى الأقصى؟", targetAngle: 40, hint: "في حال وجود ارتفاع إطلاق عن سطح الأرض تكون الزاوية المثالية أقل من 45 درجة", category: "hard" },
  { id: "a9", label: "زاوية تجعل زمن تحليق المقذوف أطول ما يمكن لسرعة ابتدائية معينة", targetAngle: 90, hint: "الزاوية العمودية 90 درجة تعطي أطول زمن تحليق في الهواء", category: "hard" },
  { id: "a10", label: "زاوية الإطلاق التي تجعل المدى الأفقي مساوياً للارتفاع الأقصى للمقذوف", targetAngle: 76, hint: "tan(θ) = 4 → θ ≈ 76 درجة", category: "hard" }
];

function genAngleScenario(level: number, usedQuestions: Set<string>) {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  let pool = ANGLE_SCENARIOS.filter(s => s.category === cat);
  if (pool.length === 0) pool = ANGLE_SCENARIOS;

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let key = `angle-${chosen.id}`;

  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosen = pool[Math.floor(Math.random() * pool.length)];
    key = `angle-${chosen.id}`;
    attempts++;
  }
  usedQuestions.add(key);

  const tolerance = level <= 3 ? 8 : level <= 6 ? 5 : level <= 9 ? 3 : 2;

  return {
    label: chosen.label,
    targetAngle: chosen.targetAngle,
    tolerance,
    hint: chosen.hint
  };
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TOTAL_Q = 10;
const BASE_TIMERS = { easy: 20, medium: 15, hard: 10 };

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

/* ─── Circuit Tap Game ──────────────────────────────────────────────────── */
function CircuitTapGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("physics"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<ReturnType<typeof genCircuitQ> | null>(null);
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
      const res = updateIQ("physics", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genCircuitQ(cur, usedQuestionsRef.current));
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
    
    advRef.current = setTimeout(() => nextQ(qIdx + 1), 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>اختر المكوّن الكهربائي الصحيح لإكمال الدائرة الكهربائية</p>
      
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
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#534AB7,#D4537E)" }}>ابدأ</button>
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
        subject="physics"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#534AB7,#D4537E)" }}>مرة أخرى</button>
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
      
      {q && (
        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-bold mb-2" style={{ color: "var(--ink)" }}>{q.description}</p>
          <div className="py-3 px-4 rounded-xl my-2 font-mono text-center text-sm whitespace-pre-wrap" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px dashed var(--border-strong)" }}>
            {q.circuit}
          </div>
          <p className="text-xs font-bold mt-2" style={{ color: "var(--ink-3)" }}>{q.missingRole}</p>
          {selected && q.explanation && (
            <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>💡 {q.explanation}</p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map(ch => {
          const isSel = selected === ch, isAns = selected !== null && ch === q.answer, isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => answer(ch)} disabled={!!selected}
              className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95 leading-snug"
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

/* ─── Angle Picker Game ─────────────────────────────────────────────────── */
function AnglePickerGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("physics"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [scenario, setScenario] = useState<ReturnType<typeof genAngleScenario> | null>(null);
  const [angle, setAngle] = useState(45);
  const [qIdx, setQIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [fired, setFired] = useState(false);
  const [hitResult, setHitResult] = useState<"hit" | "miss" | null>(null);
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);
  
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextScenario = useCallback((idx: number) => {
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
      const res = updateIQ("physics", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    setScenario(genAngleScenario(cur, usedQuestionsRef.current));
    setAngle(45);
    setFired(false);
    setHitResult(null);
    setQIdx(idx);
    tStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  const start = () => {
    if (advRef.current) clearTimeout(advRef.current);
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
    nextScenario(0);
  };

  const fire = () => {
    if (fired) return;
    setFired(true);
    const now = Date.now();
    totalMsRef.current += now - tStartRef.current;
    
    const diff_ = Math.abs(angle - scenario!.targetAngle);
    const ok = diff_ <= scenario!.tolerance;
    
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC;
    setCorrect(newC);
    
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr;
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
    
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");
    setHitResult(ok ? "hit" : "miss");

    // Dynamic level adjustment
    const prevLvl = levelRef.current;
    if (ok && levelRef.current < 10) {
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

    advRef.current = setTimeout(() => nextScenario(qIdx + 1), 1600);
  };

  useEffect(() => () => { if (advRef.current) clearTimeout(advRef.current); }, []);

  const arcPath = (deg: number) => {
    const rad = deg * Math.PI / 180;
    const vx = Math.cos(rad) * 160, vy = Math.sin(rad) * 160;
    const cx = vx / 2, cy = 80 + vy / 2;
    return `M 0 80 Q ${cx} ${Math.max(0, 80 - cy / 2)} ${vx} ${80 - vy / 3}`;
  };

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🎯</div>
      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>اختر زاوية الإطلاق الصحيحة لتصيب الهدف بدقة</p>
      
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
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#534AB7,#D4537E)" }}>ابدأ</button>
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
        subject="physics"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#534AB7,#D4537E)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>

      {/* Scenario */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>{scenario?.label}</p>
        <p className="text-[10px] text-gray-400">مدى السماح الحالي: ±{scenario?.tolerance}° درجة</p>
        {fired && hitResult && (
          <p className="text-xs font-bold mt-1" style={{ color: hitResult === "hit" ? "#1D9E75" : "#D4537E" }}>
            {hitResult === "hit" ? "✅ إصابة مباشرة! الزاوية المثالية كانت: " + scenario?.targetAngle + "°" : "❌ أخطأت الهدف! الزاوية المثالية كانت: " + scenario?.targetAngle + "°"}
          </p>
        )}
        {fired && <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>💡 {scenario?.hint}</p>}
      </div>

      {/* Visual trajectory */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", height: 120 }}>
        <svg width="100%" height="120" viewBox="0 0 300 120">
          <line x1="0" y1="100" x2="300" y2="100" stroke="var(--border-strong)" strokeWidth="2" />
          <rect x="5" y="85" width="20" height="15" rx="3" fill="#534AB7" />
          <line x1="15" y1="92" x2={15 + Math.cos((angle) * Math.PI / 180) * 30} y2={92 - Math.sin((angle) * Math.PI / 180) * 30}
            stroke="#534AB7" strokeWidth="4" strokeLinecap="round" />
          <text x="50" y="95" fontSize="12" fill="var(--ink)" fontWeight="700">{angle}°</text>
          {fired && (
            <path d={arcPath(angle)}
              stroke={hitResult === "hit" ? "#1D9E75" : "#D4537E"} strokeWidth="2" fill="none" strokeDasharray={hitResult === "miss" ? "6 3" : "0"} />
          )}
          <text x="265" y="97" fontSize="20">🎯</text>
        </svg>
      </div>

      {/* Angle slider */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-bold mb-1" style={{ color: "var(--ink-3)" }}>
          <span>0°</span><span className="font-black text-base" style={{ color: "var(--ink)" }}>{angle}°</span><span>90°</span>
        </div>
        <input type="range" min="0" max="90" value={angle} disabled={fired}
          onChange={e => setAngle(Number(e.target.value))}
          className="w-full" style={{ height: 8, accentColor: "#534AB7", cursor: fired ? "not-allowed" : "pointer" }} />
      </div>

      <button onClick={fire} disabled={fired}
        className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all active:scale-95"
        style={{ background: fired ? "var(--border)" : "linear-gradient(135deg,#534AB7,#D4537E)", cursor: fired ? "not-allowed" : "pointer" }}>
        {fired ? "🔄 جارٍ إطلاق المقذوف..." : "🚀 أطلق الآن!"}
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function PhysicsEnvironment() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [tab, setTab] = useState<"circuit" | "angle">("circuit");
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
  const skills = SUBJECT_SKILLS["physics"];

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
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>⚡ الفيزياء</span>
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
            {([["circuit", "⚡ Circuit Tap"], ["angle", "🎯 Angle Picker"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "circuit" && <CircuitTapGame key="circuit" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
          {tab === "angle" && <AnglePickerGame key="angle" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
