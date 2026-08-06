import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const cairoDayStr = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

async function main() {
  console.log("Starting streak timezone migration...");
  try {
    const users = await prisma.user.findMany({
      where: {
        loginStreak: { gt: 0 },
        lastLoginDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        lastLoginDate: true,
      },
    });

    console.log(`Found ${users.length} users with active streaks to check.`);

    const dryRun = process.argv.includes("--dry-run");
    if (dryRun) {
      console.log("ℹ️ Dry-run mode active. No database updates will be committed.");
    }

    let updatedCount = 0;
    for (const user of users) {
      if (!user.lastLoginDate) continue;

      const oldDate = user.lastLoginDate;
      const cairoDay = cairoDayStr(oldDate);
      const [y, m, d] = cairoDay.split("-").map(Number);
      const newMidnight = new Date(Date.UTC(y, m - 1, d));

      // If the timestamp changed (e.g. from 21:00:00 UTC to 00:00:00 UTC)
      if (oldDate.getTime() !== newMidnight.getTime()) {
        console.log(`${dryRun ? "[DRY RUN] Would update" : "Updating"} ${user.name} (${user.id}):`);
        console.log(`  Before: ${oldDate.toISOString()}`);
        console.log(`  After:  ${newMidnight.toISOString()} (Cairo: ${cairoDay})`);

        if (!dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginDate: newMidnight },
          });
        }
        updatedCount++;
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} users.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
