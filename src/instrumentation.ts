export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const globalForCron = globalThis as unknown as {
      leaderboardCronInitialized: boolean | undefined;
    };

    if (!globalForCron.leaderboardCronInitialized) {
      globalForCron.leaderboardCronInitialized = true;
      console.log("⏰ Initializing Leaderboard Caching & Scheduler...");

      const { refreshLeaderboard } = await import("./lib/leaderboard-refresh");
      const { prisma } = await import("./lib/prisma");
      const cron = (await import("node-cron")).default;

      // 1. Initial calculation if the cache is empty
      try {
        const cache = await prisma.leaderboardCache.findUnique({
          where: { key: "leaderboard_data" },
        });

        if (!cache) {
          console.log("⏰ Leaderboard cache is empty. Populating cache for the first time...");
          // Force is set to true to ensure it runs immediately during startup
          await refreshLeaderboard(true);
        } else {
          console.log(`⏰ Leaderboard cache already populated. Last updated at: ${cache.updatedAt.toISOString()}`);
        }

        // Auto-update teacher profiles to 180/750/1200 pricing
        await prisma.teacherProfile.updateMany({
          where: {
            OR: [
              { priceMonthly: 200 },
              { priceTermly: 600 },
            ],
          },
          data: {
            priceMonthly: 180,
            priceTermly: 750,
            priceYearly: 1200,
          },
        }).catch(() => {});
      } catch (err) {
        console.error("❌ Failed to perform initial leaderboard cache check/refresh:", err);
      }

      // 2. Setup the daily midnight scheduled cron (00:00 Africa/Cairo timezone)
      // Guard for PM2 cluster mode: only schedule on NODE_APP_INSTANCE = 0 or undefined
      const isMainInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";
      if (isMainInstance) {
        console.log("⏰ Main instance detected. Scheduling daily leaderboard refresh at 00:00 Cairo time.");
        cron.schedule(
          "0 0 * * *",
          async () => {
            console.log("⏰ Triggering daily scheduled leaderboard refresh...");
            try {
              await refreshLeaderboard();
            } catch (err) {
              console.error("❌ Scheduled leaderboard refresh failed:", err);
            }
          },
          {
            timezone: "Africa/Cairo",
          }
        );

        // 3. Setup the weekly database backup cron (Every Sunday at 02:00 AM Africa/Cairo timezone)
        console.log("⏰ Scheduling weekly database backup at 02:00 AM (Sunday) Cairo time.");
        const { performDatabaseBackup } = await import("./lib/db-backup");
        cron.schedule(
          "0 2 * * 0",
          async () => {
            console.log("⏰ Triggering weekly scheduled database backup...");
            try {
              await performDatabaseBackup();
            } catch (err) {
              console.error("❌ Scheduled database backup failed:", err);
            }
          },
          {
            timezone: "Africa/Cairo",
          }
        );
      } else {
        console.log(`⏰ Worker instance (NODE_APP_INSTANCE=${process.env.NODE_APP_INSTANCE}) detected. Skipping cron scheduling.`);
      }
    }
  }
}
