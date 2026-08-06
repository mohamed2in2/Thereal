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

/* ─── Question generators per level 1–10 ─────────────────────────────────── */
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeChoices(answer: number): number[] {
  const set = new Set<number>([answer]);
  let t = 0;
  while (set.size < 4 && t++ < 200) {
    const rng = Math.max(4, Math.floor(Math.abs(answer) * 0.35));
    const c   = answer + rand(1, rng) * (Math.random() < 0.5 ? 1 : -1);
    if (c > 0) set.add(c);
  }
  let i = 1;
  while (set.size < 4) { set.add(answer + i * 7); i++; }
  return Array.from(set).sort(() => Math.random() - 0.5);
}

interface MathQ { question: string; answer: number; choices: number[] }

const LEVEL_TIMERS: Record<Difficulty, number> = { easy: 30, medium: 22, hard: 14 };

function genMathByLevel(level: number): MathQ {
  let q = "", a = 0;
  if (level <= 1) {
    // Single-digit add/sub
    const [x, y] = [rand(1, 9), rand(1, 9)];
    q = `${x} + ${y} = ؟`; a = x + y;
  } else if (level === 2) {
    const [x, y] = [rand(10, 30), rand(1, 15)];
    const op = Math.random() < 0.5 ? "+" : "−";
    if (op === "+") { q = `${x} + ${y} = ؟`; a = x + y; }
    else { const [big, sm] = x >= y ? [x, y] : [y, x]; q = `${big} − ${sm} = ؟`; a = big - sm; }
  } else if (level === 3) {
    const [x, y] = [rand(10, 50), rand(5, 30)];
    const op = Math.random() < 0.5 ? "+" : "−";
    if (op === "+") { q = `${x} + ${y} = ؟`; a = x + y; }
    else { const [big, sm] = x >= y ? [x, y] : [y, x]; q = `${big} − ${sm} = ؟`; a = big - sm; }
  } else if (level === 4) {
    // Times tables 2–6
    const [x, y] = [rand(2, 6), rand(2, 10)];
    q = `${x} × ${y} = ؟`; a = x * y;
  } else if (level === 5) {
    // Times tables 6–12
    const [x, y] = [rand(6, 12), rand(2, 12)];
    const op = Math.random() < 0.5 ? "×" : "÷";
    if (op === "×") { q = `${x} × ${y} = ؟`; a = x * y; }
    else { q = `${x * y} ÷ ${x} = ؟`; a = y; }
  } else if (level === 6) {
    // Simple algebra: x + b = c
    const [x, b] = [rand(5, 40), rand(1, 25)];
    q = `س + ${b} = ${x + b}`; a = x;
  } else if (level === 7) {
    // Squares 2–12
    const n = rand(2, 12);
    const t = rand(0, 1);
    if (t === 0) { q = `${n}² = ؟`; a = n * n; }
    else { q = `${n} × ${n + 1} = ؟`; a = n * (n + 1); }
  } else if (level === 8) {
    // Square roots
    const perfectSq = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
    const sq = perfectSq[rand(0, perfectSq.length - 1)];
    const t  = rand(0, 1);
    if (t === 0) { q = `√${sq} = ؟`; a = Math.sqrt(sq); }
    else { const m = rand(2, 5), b = rand(1, 15); q = `${m}س + ${b} = ${m * 8 + b}   (س=؟)`; a = 8; }
  } else if (level === 9) {
    // Two-step equations: 2x + 3 = 15 → x = 6
    const x = rand(1, 20), m = rand(2, 5), b = rand(1, 15);
    q = `${m}س + ${b} = ${m * x + b}`; a = x;
  } else {
    // Level 10: challenge — powers or combined operations
    const t = rand(0, 2);
    if (t === 0) { const n = rand(2, 8); q = `${n}³ = ؟`; a = n ** 3; }
    else if (t === 1) { const [x, y, z] = [rand(2, 9), rand(2, 6), rand(1, 10)]; q = `${x} × ${y} + ${z} = ؟`; a = x * y + z; }
    else { const x = rand(2, 12); q = `${x}² − ${x} = ؟`; a = x * x - x; }
  }
  return { question: q, answer: a, choices: makeChoices(a) };
}

/* ─── Pattern questions per level ────────────────────────────────────────── */
interface PatternQ { display: string; answer: number; choices: number[] }

function genPatternByLevel(level: number): PatternQ {
  let seq: number[] = [], answer = 0;
  if (level <= 2) {
    const [s, step] = [rand(1, 15), rand(2, 8)];
    seq = [s, s + step, s + 2 * step, s + 3 * step]; answer = s + 4 * step;
  } else if (level <= 4) {
    const [s, step] = [rand(5, 50), rand(5, 20)];
    const op = Math.random() < 0.5;
    if (op) { seq = [s, s + step, s + 2 * step, s + 3 * step, s + 4 * step]; answer = s + 5 * step; }
    else    { seq = [s, s - step, s - 2 * step, s - 3 * step]; answer = s - 4 * step; }
  } else if (level <= 6) {
    // Squares
    const s = rand(1, 8);
    seq = [s ** 2, (s + 1) ** 2, (s + 2) ** 2, (s + 3) ** 2]; answer = (s + 4) ** 2;
  } else if (level <= 8) {
    // Geometric
    const [s, r] = [rand(1, 4), rand(2, 3)];
    seq = [s, s * r, s * r ** 2, s * r ** 3]; answer = s * r ** 4;
  } else {
    // Fibonacci variant
    const [a, b] = [rand(1, 8), rand(1, 8)];
    const [c, d] = [a + b, a + 2 * b];
    seq = [a, b, c, d]; answer = b + c + d - a; // next Fibonacci term
  }
  const display = [...seq.slice(0, 4), "؟"].join("  ،  ");
  return { display, answer, choices: makeChoices(answer) };
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const TOTAL_Q = 12;

/* ─── Level badge ────────────────────────────────────────────────────────── */
function LevelBadge({ level, anim }: { level: number; anim: boolean }) {
  const diff = levelToDifficulty(level);
  const colors = { easy: "#1D9E75", medium: "#EF9F27", hard: "#D4537E" };
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black text-white transition-all ${anim ? "scale-125" : ""}`}
        style={{ background: colors[diff] }}>
        Lv.{level}
        {anim && <span className="mr-1">⬆️</span>}
      </div>
    </div>
  );
}

/* ─── Generic Dynamic Game Engine ────────────────────────────────────────── */
interface DynGameProps {
  subject: string;
  genQuestion: (level: number) => { question?: string; display?: string; answer: number; choices: number[] };
  renderQ: (q: { question?: string; display?: string }, level: number) => React.ReactNode;
  onFinish: () => void;
  accentGradient: string;
  initialDiff: Difficulty;
}

function DynamicGameEngine({ subject, genQuestion, renderQ, onFinish, accentGradient, initialDiff }: DynGameProps) {
  const startLevel = difficultyToStartLevel(initialDiff);
  const [level, setLevel]           = useState(startLevel);
  const [levelAnim, setLevelAnim]   = useState(false);
  const [state, setState]           = useState<"playing" | "result">("playing");
  const [q, setQ]                   = useState(() => genQuestion(startLevel));
  const [qIdx, setQIdx]             = useState(0);
  const [selected, setSelected]     = useState<number | null>(null);
  const [correct, setCorrect]       = useState(0);
  const [streak, setStreak]         = useState(0);
  const [maxStreak, setMaxStreak]   = useState(0);
  const [timerPct, setTimerPct]     = useState(100);
  const [result, setResult]         = useState<{ sessionScore: number; newIQ: number; correct: number } | null>(null);
  const [levels, setLevels]         = useState<number[]>([]); // level per question for avg

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef  = useRef(Date.now());
  const totalMsRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef  = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef  = useRef<number[]>([]);
  const levelRef   = useRef(startLevel);

  const clear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  };

  const nextQ = useCallback((idx: number) => {
    if (idx >= TOTAL_Q) {
      // Done
      const avgLevel = levelsRef.current.reduce((a, b) => a + b, 0) / levelsRef.current.length;
      const gameResult: GameResult = {
        correct: correctRef.current, total: TOTAL_Q,
        totalTimeMs: totalMsRef.current, avgLevel,
        maxStreak: maxStreakRef.current, difficulty: levelToDifficulty(levelRef.current),
      };
      const res = updateIQ(subject, gameResult);
      setResult({ sessionScore: res.sessionScore, newIQ: res.newOverallIQ, correct: correctRef.current });
      setState("result"); onFinish(); return;
    }
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    setLevels([...levelsRef.current]);
    const timerSecs = levelToTimer(cur, LEVEL_TIMERS);
    setQ(genQuestion(cur)); setSelected(null); setQIdx(idx); setTimerPct(100);
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      const pct = Math.max(0, 100 - (elapsed / (timerSecs * 1000)) * 100);
      setTimerPct(pct);
      if (elapsed >= timerSecs * 1000) {
        clearInterval(timerRef.current!);
        vibrate("wrong");
        // Slow → decrease level
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
        setSelected(-9999);
        const now = Date.now(); totalMsRef.current += now - startRef.current; startRef.current = now;
        streakRef.current = 0; setStreak(0);
        advRef.current = setTimeout(() => nextQ(idx + 1), 900);
      }
    }, 100);
    startRef.current = Date.now();
  }, [genQuestion, onFinish, subject]);

  const handleAnswer = useCallback((choice: number) => {
    if (selected !== null) return;
    clear();
    setSelected(choice);
    const now = Date.now(); totalMsRef.current += now - startRef.current;
    const timerSecs = levelToTimer(levelRef.current, LEVEL_TIMERS);
    const timeUsedPct = (now - startRef.current) / (timerSecs * 1000);
    const ok = choice === q.answer;
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC; setCorrect(newC);
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr; setStreak(newStr);
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr); setMaxStreak(maxStreakRef.current);
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");

    // Dynamic level adjustment
    const prevLevel = levelRef.current;
    if (ok && timeUsedPct < 0.4 && levelRef.current < 10) {
      levelRef.current = Math.min(10, levelRef.current + 1);
      setLevel(levelRef.current);
      if (levelRef.current > prevLevel) { setLevelAnim(true); setTimeout(() => setLevelAnim(false), 800); vibrate("levelup"); }
    } else if (!ok && levelRef.current > 1) {
      levelRef.current = Math.max(1, levelRef.current - 1);
      setLevel(levelRef.current);
    }
    advRef.current = setTimeout(() => nextQ(qIdx + 1), 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "result" && result) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 52 }}>{result.correct >= 10 ? "🏆" : result.correct >= 7 ? "⭐" : "💪"}</div>
      <h3 className="text-2xl font-black mb-1" style={{ color: "var(--ink)" }}>{result.correct}/{TOTAL_Q} صحيح</h3>
      <p className="text-sm mb-3" style={{ color: "var(--ink-3)" }}>
        مستوى وصلت له: Lv.{Math.max(...levels)} · streak أكبر: {maxStreak}
      </p>
      <div className="rounded-xl p-4 mb-4" style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>نقاط الجلسة</div>
        <div className="text-3xl font-black" style={{ color: "var(--brand)" }}>{result.sessionScore.toLocaleString("ar-EG")}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>IQ الكلي: <strong>{result.newIQ}</strong></div>
      </div>
      {/* Level distribution */}
      <div className="flex justify-center gap-1 mb-4 flex-wrap">
        {levels.map((l, i) => (
          <span key={i} className="w-6 h-6 text-xs font-bold rounded flex items-center justify-center text-white"
            style={{ background: levelToDifficulty(l) === "easy" ? "#1D9E75" : levelToDifficulty(l) === "medium" ? "#EF9F27" : "#D4537E" }}>
            {l}
          </span>
        ))}
      </div>
      {/* AI Feedback */}
      <GameFeedback
        subject={subject}
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={Math.max(...levels, 1)}
        maxStreak={maxStreak}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-2 mt-3">
        <Link href="/environments/iq" className="flex-1 py-3 rounded-xl font-black text-center text-sm"
          style={{ background: "var(--brand-soft)", color: "var(--brand)", border: "1px solid var(--brand)" }}>
          🧠 IQ
        </Link>
        <button onClick={() => { clear(); correctRef.current=0; streakRef.current=0; maxStreakRef.current=0; levelsRef.current=[]; totalMsRef.current=0; levelRef.current=startLevel; setLevel(startLevel); setCorrect(0); setStreak(0); setMaxStreak(0); setLevels([]); setResult(null); setState("playing"); nextQ(0); }}
          className="flex-1 py-3 rounded-xl font-black text-white text-sm"
          style={{ background: accentGradient }}>
          العب مرة أخرى
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Timer */}
      <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100"
          style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#D4537E" }}>🔥 {streak}</span>
      </div>

      {/* Question */}
      <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {renderQ(q, level)}
      </div>

      {/* Choices 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q.choices.map(ch => {
          const isSel = selected === ch, isAns = selected !== null && ch === q.answer, isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => handleAnswer(ch)} disabled={selected !== null}
              className="py-4 rounded-2xl text-xl font-black transition-all active:scale-95"
              style={{ minHeight: 64, background: isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--surface)",
                color: (isAns || isWrong) ? "#fff" : "var(--ink)",
                border: `2px solid ${isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--border)"}` }}>
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Idle / Difficulty picker wrapper ───────────────────────────────────── */
function GameWithIdleState({ title, description, subject, genQ, renderQ, gradient, children: _c, ...rest }: {
  title: string; description: string; subject: string;
  genQ: (l: number) => { question?: string; display?: string; answer: number; choices: number[] };
  renderQ: (q: { question?: string; display?: string }, level: number) => React.ReactNode;
  gradient: string;
  onFinish: () => void;
  children?: React.ReactNode;
}) {
  const [started, setStarted]   = useState(false);
  const [diff, setDiff]         = useState<Difficulty>(() => getRecommendedDifficulty(subject));
  const DIFF_LABEL: Record<Difficulty, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
  const DIFF_COLOR: Record<Difficulty, string> = { easy: "#1D9E75", medium: "#EF9F27", hard: "#D4537E" };

  if (!started) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🎮</div>
      <h3 className="text-lg font-black mb-1" style={{ color: "var(--ink)" }}>{title}</h3>
      <p className="text-sm mb-2" style={{ color: "var(--ink-3)" }}>{description}</p>
      <p className="text-xs mb-5" style={{ color: "var(--ink-3)" }}>
        {TOTAL_Q} سؤال · المستوى يزيد كلما أجبت بسرعة ⚡
      </p>
      <div className="flex gap-2 justify-center mb-5">
        {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
          <button key={d} onClick={() => setDiff(d)} className="px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: diff === d ? DIFF_COLOR[d] : "var(--surface-2)", color: diff === d ? "#fff" : "var(--ink-3)", border: `2px solid ${diff === d ? DIFF_COLOR[d] : "var(--border)"}` }}>
            {DIFF_LABEL[d]}
          </button>
        ))}
      </div>
      <button onClick={() => setStarted(true)} className="w-full py-4 rounded-2xl font-black text-lg text-white"
        style={{ background: gradient }}>
        ابدأ اللعب
      </button>
    </div>
  );

  return (
    <DynamicGameEngine
      key={diff}
      subject={subject}
      genQuestion={genQ}
      renderQ={renderQ}
      initialDiff={diff}
      accentGradient={gradient}
      {...rest}
    />
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function MathEnvironment() {
  const [user, setUser]     = useState<MeUser | null>(null);
  const [tab, setTab]       = useState<"speed" | "pattern">("speed");
  const [iqData, setIqData] = useState<IQData>(() => getIQData());

  useEffect(() => { fetchMeWithRetry(2, 100).then(me => setUser(me)).catch(() => {}); }, []);
  const refreshIQ = () => setIqData(getIQData());
  const skills = SUBJECT_SKILLS["math"];

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Link href="/environments" className="flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ink-3)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              البيئات
            </Link>
            <span style={{ color: "var(--border-strong)" }}>›</span>
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>🔢 الرياضيات</span>
            <div className="mr-auto flex items-center gap-2 flex-wrap">
              {(skills as (keyof typeof SKILL_LABELS)[]).map(sk => (
                <span key={sk} className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ background: SKILL_COLORS[sk] + "22", color: SKILL_COLORS[sk] }}>
                  {SKILL_LABELS[sk]} {iqData.skills[sk].score}
                </span>
              ))}
              <Link href="/environments/iq" className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                🧠 {iqData.overallIQ}
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {([["speed", "⚡ Speed Math Arena"], ["pattern", "🔢 Pattern Unlock"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "speed" && (
            <GameWithIdleState key="speed" title="Speed Math Arena" subject="math"
              description="أجب بسرعة لترفع المستوى — الإجابة قبل 40% من الوقت = ترقية فورية!"
              genQ={genMathByLevel}
              renderQ={(q, level) => (
                <div>
                  <div className="text-xs font-bold mb-2" style={{ color: "var(--ink-3)" }}>مستوى {level}</div>
                  <p className="text-3xl font-black" style={{ color: "var(--ink)", direction: "ltr" }}>{q.question}</p>
                </div>
              )}
              gradient="linear-gradient(135deg,#534AB7,#7F77DD)"
              onFinish={refreshIQ}
            />
          )}
          {tab === "pattern" && (
            <GameWithIdleState key="pattern" title="Pattern Unlock" subject="math"
              description="اكتشف قانون المتتالية وأكمل الرقم المفقود"
              genQ={genPatternByLevel}
              renderQ={(q, level) => (
                <div>
                  <div className="text-xs font-bold mb-2" style={{ color: "var(--ink-3)" }}>مستوى {level}</div>
                  <p className="text-xl font-black" style={{ color: "var(--ink)", direction: "ltr" }}>{q.display}</p>
                </div>
              )}
              gradient="linear-gradient(135deg,#2196F3,#534AB7)"
              onFinish={refreshIQ}
            />
          )}

        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
