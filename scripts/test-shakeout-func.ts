import { getShakeOutInvoiceStatus, SHAKEOUT_PAID_STATUSES } from "../src/lib/shakeout";
import fs from "fs";
import path from "path";

// Load env
const envContent = fs.readFileSync(path.join(__dirname, "../.env"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
  }
}

async function test() {
  console.log("Testing getShakeOutInvoiceStatus('dEB966yJoW/qiXmOqwMsLcri0iU')...");
  const result = await getShakeOutInvoiceStatus("dEB966yJoW/qiXmOqwMsLcri0iU");
  console.log("Result:", JSON.stringify(result, null, 2));

  const isPaid = SHAKEOUT_PAID_STATUSES.includes(String(result.data?.status || "").toLowerCase());
  console.log(`Is Paid Recognized: ${isPaid}`);
  if (isPaid && result.data?.reference === "dEB966yJoW/qiXmOqwMsLcri0iU") {
    console.log("✅ PERFECT! Shake-Out status is successfully recognized as PAID!");
  } else {
    console.error("❌ Recognition failed");
  }
}

test().catch(console.error);
