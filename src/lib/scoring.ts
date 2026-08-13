/**
 * Score semantics.
 *
 * The two result models store `score` in **different units**, which has caused
 * real display bugs — a quiz percentage divided again by the question count
 * renders as e.g. 2833%.
 *
 *   QuizResult.score       — already a PERCENTAGE 0..100.
 *                            Written by /api/quizzes/[id]/submit as
 *                            `Number(((correct / totalQ) * 100).toFixed(2))`.
 *                            `totalQ` is the question count, NOT the max score.
 *
 *   DailyExamResult.score  — a RAW COUNT of correct answers, out of `totalQ`.
 *                            Written by /leaderboard/daily-exam/[id].
 *
 * Always go through these helpers rather than dividing by `totalQ` at the call
 * site; that is the mistake this module exists to prevent.
 */

/** Percentage (0..100) for a QuizResult row, whose score is already a percent. */
export function quizResultPercent(result: { score: number; totalQ: number }): number {
  if (!Number.isFinite(result.score)) return 0;
  // Clamped because a malformed row must not produce an impossible figure in a
  // parent- or student-facing report.
  return Math.max(0, Math.min(100, result.score));
}

/** Percentage (0..100) for a DailyExamResult row, whose score is a raw count. */
export function examResultPercent(result: { score: number; totalQ: number }): number {
  if (!Number.isFinite(result.score) || !result.totalQ || result.totalQ <= 0) return 0;
  return Math.max(0, Math.min(100, (result.score / result.totalQ) * 100));
}

/**
 * Mean percentage across a mixed set of quiz and exam results.
 *
 * Each result contributes its own percentage equally. Summing raw `score`
 * values and dividing by summed `totalQ` — as the parent portal previously did
 * — mixes percentages with counts and produces a meaningless number.
 */
export function averagePercent(
  quizzes: Array<{ score: number; totalQ: number }>,
  exams: Array<{ score: number; totalQ: number }>
): number | null {
  const percents = [
    ...quizzes.map(quizResultPercent),
    ...exams.map(examResultPercent),
  ];
  if (percents.length === 0) return null;
  return Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);
}
