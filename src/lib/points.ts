import { prisma } from "@/lib/prisma";

export const POINTS = {
  EXAM_FULL_SCORE: 50,
  COURSE_ENROLLMENT: 20,
  DAILY_LOGIN_STREAK: 5, // per day
  FIRST_TRY_BONUS: 15,
  DAILY_EXAM_QUESTION: 5, // 5 points per correct daily exam question
  DAILY_EXAM_FULL_SCORE: 10, // 10 points bonus for perfect daily exam score
  REFERRAL: 50, // 50 points per qualified referral for inviter and invited student
};

/**
 * Awards points to a user and updates their pointsUpdatedAt timestamp.
 * If the streak is broken (lastLoginDate is not yesterday), the streak is reset.
 *
 * Uses Africa/Cairo timezone for day boundaries — the user base is Egyptian,
 * and a UTC boundary breaks streaks at 2 AM Cairo time.
 */
export async function awardDailyLoginPoints(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Cairo-local day boundary: format the date as YYYY-MM-DD in Cairo timezone,
  // then compare calendar dates. This is DST-safe and deterministic.
  const cairoDayStr = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }); // "2026-06-20"

  const todayStr = cairoDayStr(new Date());

  let newStreak = 1;
  let pointsToAward = POINTS.DAILY_LOGIN_STREAK;

  if (user.lastLoginDate) {
    const lastStr = cairoDayStr(new Date(user.lastLoginDate));
    if (lastStr === todayStr) {
      // Already counted today — award nothing.
      return;
    }

    // Parse both dates to compute day difference
    const [ty, tm, td] = todayStr.split("-").map(Number);
    const [ly, lm, ld] = lastStr.split("-").map(Number);
    const todayMs = Date.UTC(ty, tm - 1, td);
    const lastMs = Date.UTC(ly, lm - 1, ld);
    const dayDiff = Math.round((todayMs - lastMs) / 86_400_000);

    if (dayDiff === 1) {
      // Consecutive day → streak continues.
      newStreak = user.loginStreak + 1;
      pointsToAward = newStreak * POINTS.DAILY_LOGIN_STREAK;
    } else {
      // Gap of 2+ days → streak resets.
      newStreak = 1;
      pointsToAward = POINTS.DAILY_LOGIN_STREAK;
    }
  }

  // Store lastLoginDate as midnight UTC of the Cairo calendar day.
  const [y, m, d] = todayStr.split("-").map(Number);
  const todayCairoMidnight = new Date(Date.UTC(y, m - 1, d));

  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: pointsToAward },
      loginStreak: newStreak,
      lastLoginDate: todayCairoMidnight,
      pointsUpdatedAt: new Date(),
    },
  });
}

/**
 * Awards points for completing a daily exam.
 * @param userId Student ID
 * @param score Number of correct answers
 * @param totalQ Total number of questions
 */
export async function awardDailyExamPoints(userId: string, score: number, totalQ: number) {
  // Balanced points: 5 points per correct answer + 10 points bonus for perfect score
  let pointsToAward = score * POINTS.DAILY_EXAM_QUESTION;
  if (score === totalQ && totalQ > 0) {
    pointsToAward += POINTS.DAILY_EXAM_FULL_SCORE;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: pointsToAward },
      pointsUpdatedAt: new Date(),
    },
  });
}

/**
 * General purpose point award function.
 */
export async function addPoints(userId: string, points: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: points },
      pointsUpdatedAt: new Date(),
    },
  });
}
