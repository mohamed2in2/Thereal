import fs from "fs";
import path from "path";

async function main() {
  console.log("================================================================================");
  console.log("🌐 Live Shake-Out API Direct Query for Invoice: dEB966yJoW / qiXmOqwMsLcri0iU");
  console.log("================================================================================");

  // Load env manually if needed
  const envContent = fs.readFileSync(path.join(__dirname, "../.env"), "utf-8");
  const envVars: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
    }
  }

  const publicKey = process.env.SHAKEOUT_PUBLIC_KEY || envVars["SHAKEOUT_PUBLIC_KEY"];
  const baseUrl = (process.env.SHAKEOUT_BASE_URL || envVars["SHAKEOUT_BASE_URL"] || "https://dash.shake-out.com").replace(/\/$/, "");

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Public Key: ${publicKey ? publicKey.slice(0, 8) + "..." : "MISSING"}`);

  if (!publicKey) {
    console.log("❌ SHAKEOUT_PUBLIC_KEY is not set in environment or .env!");
    return;
  }

  const invoiceId = "dEB966yJoW";
  const invoiceRef = "qiXmOqwMsLcri0iU";

  // Test 1: id/ref endpoint
  const url1 = `${baseUrl}/api/public/vendor/invoice-status/${invoiceId}/${invoiceRef}`;
  console.log(`\nTesting URL 1: ${url1}`);

  try {
    const res1 = await fetch(url1, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `apikey ${publicKey}`,
      },
    });
    console.log(`Status code: ${res1.status} ${res1.statusText}`);
    const data1 = await res1.json().catch(() => ({}));
    console.log("Response JSON:", JSON.stringify(data1, null, 2));
  } catch (err: any) {
    console.log("Error URL 1:", err.message);
  }

  // Test 2: id endpoint only
  const url2 = `${baseUrl}/api/public/vendor/invoice-status/${invoiceId}`;
  console.log(`\nTesting URL 2: ${url2}`);

  try {
    const res2 = await fetch(url2, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `apikey ${publicKey}`,
      },
    });
    console.log(`Status code: ${res2.status} ${res2.statusText}`);
    const data2 = await res2.json().catch(() => ({}));
    console.log("Response JSON:", JSON.stringify(data2, null, 2));
  } catch (err: any) {
    console.log("Error URL 2:", err.message);
  }
}

main().catch(console.error);
