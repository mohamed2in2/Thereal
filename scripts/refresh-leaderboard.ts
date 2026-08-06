import "dotenv/config";
import { refreshLeaderboard } from "../src/lib/leaderboard-refresh";

async function main() {
  const force = process.argv.includes("--force");
  console.log(`[${new Date().toISOString()}] 🚀 Manual cache refresh starting (force=${force})...`);
  try {
    await refreshLeaderboard(force);
    console.log(`[${new Date().toISOString()}] ✅ Cache refresh script finished successfully.`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Cache refresh script failed:`, error);
    process.exit(1);
  }
}

main();
