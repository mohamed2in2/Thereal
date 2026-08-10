import { prisma } from "./prisma";

interface StudentPointsRow {
  id: string;
  name: string;
  points: number;
  educationalStage: string | null;
}

interface StudentStreakRow {
  id: string;
  name: string;
  loginStreak: number;
  educationalStage: string | null;
}

interface AdminRow {
  id: string;
  name: string;
  points: number;
  loginStreak: number;
  educationalStage: string | null;
  phone: string | null;
  email: string;
  parentPhone: string | null;
  age: number | null;
}

export interface LeaderboardPrize {
  rank: number;
  rankLabel: string;
  title: string;
  prize: string;
  icon?: string;
  highlight?: boolean;
}

export const DEFAULT_LEADERBOARD_PRIZES: LeaderboardPrize[] = [
  { rank: 1, rankLabel: "المركز الأول", title: "بطل المنصة", prize: "حقيبة ظهر فاخرة + سماعات لاسلكية + تيشيرت المنصة + 1000 نقطة", icon: "🥇", highlight: true },
  { rank: 2, rankLabel: "المركز الثاني", title: "الوصيف الأول", prize: "باور بانك سريع + تيشيرت المنصة + 750 نقطة", icon: "🥈", highlight: true },
  { rank: 3, rankLabel: "المركز الثالث", title: "المركز الثالث", prize: "مج حراري ذكي + تيشيرت المنصة + 500 نقطة", icon: "🥉", highlight: true },
  { rank: 4, rankLabel: "المركز الرابع", title: "المركز الرابع", prize: "تيشيرت المنصة + ميدالية تفوق + 350 نقطة", icon: "🎖️", highlight: false },
  { rank: 5, rankLabel: "المركز الخامس", title: "المركز الخامس", prize: "تيشيرت المنصة + دفتر كود-أب + 300 نقطة", icon: "⭐", highlight: false },
  { rank: 6, rankLabel: "المركز السادس", title: "المركز السادس", prize: "اشتراك مجاني شهر بكورس اختياري + 250 نقطة", icon: "🎁", highlight: false },
  { rank: 7, rankLabel: "المركز السابع", title: "المركز السابع", prize: "كوبون خصم 50% + 200 نقطة", icon: "🏷️", highlight: false },
  { rank: 8, rankLabel: "المركز الثامن", title: "المركز الثامن", prize: "كوبون خصم 30% + 150 نقطة", icon: "✨", highlight: false },
  { rank: 9, rankLabel: "المركز التاسع", title: "المركز التاسع", prize: "شارة تفوق رقمية + 100 نقطة", icon: "💫", highlight: false },
  { rank: 10, rankLabel: "المركز العاشر", title: "المركز العاشر", prize: "شارة تفوق رقمية + 50 نقطة", icon: "🌟", highlight: false },
];

export async function getLeaderboardPrizes(): Promise<LeaderboardPrize[]> {
  try {
    const row = await prisma.leaderboardCache.findUnique({
      where: { key: "leaderboard_prizes" },
    });
    if (row?.data) {
      const parsed = JSON.parse(row.data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error("Failed to load custom leaderboard prizes, falling back to defaults:", err);
  }
  return DEFAULT_LEADERBOARD_PRIZES;
}

export async function saveLeaderboardPrizes(prizes: LeaderboardPrize[]): Promise<void> {
  await prisma.leaderboardCache.upsert({
    where: { key: "leaderboard_prizes" },
    update: {
      data: JSON.stringify(prizes),
      updatedAt: new Date(),
    },
    create: {
      key: "leaderboard_prizes",
      data: JSON.stringify(prizes),
      updatedAt: new Date(),
    },
  });

  // Also update active cache snapshot with new prizes without full DB recompute
  try {
    const mainCache = await prisma.leaderboardCache.findUnique({
      where: { key: "leaderboard_data" },
    });
    if (mainCache?.data) {
      const parsed = JSON.parse(mainCache.data);
      parsed.prizes = prizes;
      parsed.updatedAt = new Date().toISOString();
      await prisma.leaderboardCache.update({
        where: { key: "leaderboard_data" },
        data: {
          data: JSON.stringify(parsed),
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("Failed to update prizes in main cache:", err);
  }
}

export function getCompetitionTier(stage: string | null): string[] {
  if (!stage) return [];
  if (stage.startsWith("primary")) return ["primary_4", "primary_5", "primary_6"];
  if (stage.startsWith("prep"))    return ["prep_1", "prep_2", "prep_3"];
  if (stage.startsWith("sec"))     return ["sec_1", "sec_2"];
  return [];
}

export async function refreshLeaderboard(force = false) {
  const now = new Date();
  const lockKey = "leaderboard_lock";
  const lockTimeoutMs = 5 * 60 * 1000; // 5 minutes
  const cutoffTime = new Date(now.getTime() - lockTimeoutMs);

  console.log(`[${now.toISOString()}] 🔄 Leaderboard refresh check initiated (force=${force})...`);

  if (!force) {
    // Ensure the lock row exists
    await prisma.leaderboardCache.upsert({
      where: { key: lockKey },
      update: {},
      create: {
        key: lockKey,
        data: "lock",
        updatedAt: new Date(0),
      },
    });

    // Attempt to acquire lock atomically
    const affected = await prisma.$executeRaw`
      UPDATE "LeaderboardCache"
      SET "updatedAt" = ${now}
      WHERE "key" = ${lockKey}
        AND ("updatedAt" < ${cutoffTime} OR "updatedAt" IS NULL)
    `;

    if (affected === 0) {
      console.log(`[${now.toISOString()}] ⚠️ Another process is already refreshing the leaderboard. Skipping.`);
      return;
    }
    console.log(`[${now.toISOString()}] 🔒 Lock acquired successfully.`);
  }

  try {
    // Fetch all student users
    const users = await prisma.user.findMany({
      where: { role: "student" },
      select: {
        id: true,
        name: true,
        points: true,
        pointsUpdatedAt: true,
        loginStreak: true,
        lastLoginDate: true,
        educationalStage: true,
        phone: true,
        email: true,
        parentPhone: true,
        age: true,
      },
    });

    console.log(`[${new Date().toISOString()}] Retrieved ${users.length} student users for ranking computation.`);

    // Helper functions for sorting
    const getPointsTime = (u: any) => u.pointsUpdatedAt ? new Date(u.pointsUpdatedAt).getTime() : 0;
    const getStreakTime = (u: any) => u.lastLoginDate ? new Date(u.lastLoginDate).getTime() : 0;

    const sortPoints = (a: any, b: any) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return getPointsTime(a) - getPointsTime(b);
    };

    const sortStreaks = (a: any, b: any) => {
      if (b.loginStreak !== a.loginStreak) {
        return b.loginStreak - a.loginStreak;
      }
      return getStreakTime(b) - getStreakTime(a);
    };

    // Helper for mapping to student view (no phone/email/parentPhone/age)
    const mapToStudent = (u: any): StudentPointsRow => ({
      id: u.id,
      name: u.name,
      points: u.points,
      educationalStage: u.educationalStage,
    });

    const mapToStreakStudent = (u: any): StudentStreakRow => ({
      id: u.id,
      name: u.name,
      loginStreak: u.loginStreak,
      educationalStage: u.educationalStage,
    });

    const mapToAdmin = (u: any): AdminRow => ({
      id: u.id,
      name: u.name,
      points: u.points,
      loginStreak: u.loginStreak,
      educationalStage: u.educationalStage,
      phone: u.phone,
      email: u.email,
      parentPhone: u.parentPhone,
      age: u.age,
    });

    // Group users into tiers
    const primaryUsers = users.filter(u => getCompetitionTier(u.educationalStage).length > 0 && u.educationalStage?.startsWith("primary"));
    const prepUsers    = users.filter(u => getCompetitionTier(u.educationalStage).length > 0 && u.educationalStage?.startsWith("prep"));
    const secUsers     = users.filter(u => getCompetitionTier(u.educationalStage).length > 0 && u.educationalStage?.startsWith("sec"));
    const allUsers     = users; // no filter

    // Compute top 10 lists
    // points top 10
    const topStudentsAdmin = allUsers.filter(u => u.points > 0).sort(sortPoints).slice(0, 10).map(mapToAdmin);
    const topStudentsAll = allUsers.filter(u => u.points > 0).sort(sortPoints).slice(0, 10).map(mapToStudent);
    const topStudentsPrimary = primaryUsers.filter(u => u.points > 0).sort(sortPoints).slice(0, 10).map(mapToStudent);
    const topStudentsPrep = prepUsers.filter(u => u.points > 0).sort(sortPoints).slice(0, 10).map(mapToStudent);
    const topStudentsSec = secUsers.filter(u => u.points > 0).sort(sortPoints).slice(0, 10).map(mapToStudent);

    // streak top 10
    const topStreakersAdmin = allUsers.filter(u => u.loginStreak > 0).sort(sortStreaks).slice(0, 10).map(mapToAdmin);
    const topStreakersAll = allUsers.filter(u => u.loginStreak > 0).sort(sortStreaks).slice(0, 10).map(mapToStreakStudent);
    const topStreakersPrimary = primaryUsers.filter(u => u.loginStreak > 0).sort(sortStreaks).slice(0, 10).map(mapToStreakStudent);
    const topStreakersPrep = prepUsers.filter(u => u.loginStreak > 0).sort(sortStreaks).slice(0, 10).map(mapToStreakStudent);
    const topStreakersSec = secUsers.filter(u => u.loginStreak > 0).sort(sortStreaks).slice(0, 10).map(mapToStreakStudent);

    // Calculate ranks for all student users
    const userRanks: Record<string, { pointsRank: number; streakRank: number }> = {};

    // For points rank: sort each tier's entire list
    const sortedPointsAll = [...allUsers].sort(sortPoints);
    const sortedPointsPrimary = [...primaryUsers].sort(sortPoints);
    const sortedPointsPrep = [...prepUsers].sort(sortPoints);
    const sortedPointsSec = [...secUsers].sort(sortPoints);

    // For streak rank: sort each tier's entire list
    const sortedStreaksAll = [...allUsers].sort(sortStreaks);
    const sortedStreaksPrimary = [...primaryUsers].sort(sortStreaks);
    const sortedStreaksPrep = [...prepUsers].sort(sortStreaks);
    const sortedStreaksSec = [...secUsers].sort(sortStreaks);

    for (const u of allUsers) {
      let tierPointsList = sortedPointsAll;
      let tierStreaksList = sortedStreaksAll;

      const stage = u.educationalStage;
      if (stage) {
        if (stage.startsWith("primary")) {
          tierPointsList = sortedPointsPrimary;
          tierStreaksList = sortedStreaksPrimary;
        } else if (stage.startsWith("prep")) {
          tierPointsList = sortedPointsPrep;
          tierStreaksList = sortedStreaksPrep;
        } else if (stage.startsWith("sec")) {
          tierPointsList = sortedPointsSec;
          tierStreaksList = sortedStreaksSec;
        }
      }

      // Points rank is index + 1 in the sorted points list (stable total ordering)
      const pointsRank = tierPointsList.findIndex(x => x.id === u.id) + 1;

      // Streak rank is count of students with strictly higher streak + 1
      let streakRank = 0;
      if (u.loginStreak > 0) {
        streakRank = tierStreaksList.filter(x => x.loginStreak > u.loginStreak).length + 1;
      }

      userRanks[u.id] = { pointsRank, streakRank };
    }

    const prizes = await getLeaderboardPrizes();

    const computedData = {
      topStudents: {
        admin: topStudentsAdmin,
        student_all: topStudentsAll,
        student_primary: topStudentsPrimary,
        student_prep: topStudentsPrep,
        student_sec: topStudentsSec,
      },
      topStreakers: {
        admin: topStreakersAdmin,
        student_all: topStreakersAll,
        student_primary: topStreakersPrimary,
        student_prep: topStreakersPrep,
        student_sec: topStreakersSec,
      },
      userRanks,
      prizes,
      updatedAt: new Date().toISOString(),
    };

    // Save to Cache Table
    await prisma.leaderboardCache.upsert({
      where: { key: "leaderboard_data" },
      update: {
        data: JSON.stringify(computedData),
        updatedAt: new Date(),
      },
      create: {
        key: "leaderboard_data",
        data: JSON.stringify(computedData),
        updatedAt: new Date(),
      },
    });

    console.log(`[${new Date().toISOString()}] ✅ Leaderboard cache successfully updated.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to refresh leaderboard cache:`, error);
    throw error;
  } finally {
    if (!force) {
      // Release lock by setting updatedAt to a very old date (unlocked)
      await prisma.leaderboardCache.update({
        where: { key: lockKey },
        data: { updatedAt: new Date(0) },
      });
      console.log(`[${new Date().toISOString()}] 🔓 Lock released successfully.`);
    }
  }
}
