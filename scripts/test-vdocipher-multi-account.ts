import {
  encryptVdoCipherSecret,
  decryptVdoCipherSecret,
  maskApiKey,
  getAccountWithComputedStats,
  estimateSessionBandwidth,
  BYTES_PER_GB,
} from "../src/lib/vdocipher-accounts";

async function runTests() {
  console.log("=== Running VdoCipher Multi-Account Engine Verification ===");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Encryption & Decryption
  console.log("\n[Test 1] AES-256-GCM Encryption & Decryption");
  const testSecret = "vdocipher_secret_key_1234567890abcdef";
  const encrypted = encryptVdoCipherSecret(testSecret);
  assert(encrypted !== testSecret, "Ciphertext is encrypted");
  assert(encrypted.split(":").length === 3, "Ciphertext format has IV:Tag:Data format");

  const decrypted = decryptVdoCipherSecret(encrypted);
  assert(decrypted === testSecret, "Decrypted text exactly matches original secret");

  // 2. API Key Masking
  console.log("\n[Test 2] API Key Masking for Safe Display");
  const masked = maskApiKey(testSecret);
  assert(masked.startsWith("••••••••"), "Key is masked with bullets");
  assert(masked.endsWith("cdef"), "Key ends with last 4 characters");
  assert(!masked.includes("1234567890"), "Middle of key is not leaked in masked string");

  // 3. Bandwidth and Stats Computations
  console.log("\n[Test 3] Secret Bandwidth Accounting & Stats Computation");
  const mockAccount = {
    id: "acc-1",
    name: "Account #01",
    apiKeyEnc: encrypted,
    playerId: "player_abc",
    bandwidthLimitBytes: BigInt(5 * BYTES_PER_GB), // 5 GB
    bandwidthUsedBytes: BigInt(2 * BYTES_PER_GB), // 2 GB used
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days remaining
    isActive: true,
    notes: "Production node",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const reservedBytes = BigInt(500 * 1024 * 1024); // 500 MB reserved
  const stats = await getAccountWithComputedStats(mockAccount as any, reservedBytes, 2);

  assert(stats.bandwidthLimitGb === 5, "Bandwidth limit is 5 GB");
  assert(stats.bandwidthUsedGb === 2, "Bandwidth used is 2 GB");
  assert(stats.daysRemaining === 15, "Days remaining is 15");
  assert(stats.isExpired === false, "Account is not expired");
  assert(stats.activeViewersCount === 2, "Active viewers is 2");

  // Safe remaining = 5GB - 2GB - 500MB = 2.5GB (2.51 GB)
  assert(stats.bandwidthSafeRemainingGb > 2.4 && stats.bandwidthSafeRemainingGb < 2.6, "Safe remaining capacity calculated accurately");
  assert(stats.bandwidthPercentUsed === 50, "Percent used accurately calculated as 50% (2GB / 5GB)");
  assert(stats.isEligibleForPlayback === true, "Account is eligible for playback");
  assert(stats.isEligibleForUpload === true, "Account is eligible for upload");

  // 4. Session Bandwidth Estimation
  console.log("\n[Test 4] Session Bandwidth Estimation");
  const estShort = estimateSessionBandwidth({ durationSeconds: 60 * 30 }); // 30 min ~ 300MB
  assert(estShort > 250 * 1024 * 1024 && estShort < 350 * 1024 * 1024, "30-min video estimated ~300MB");

  const estLong = estimateSessionBandwidth({ durationSeconds: 60 * 120 }); // 120 min ~ 1.2GB
  assert(estLong > 1000 * 1024 * 1024 && estLong < 1300 * 1024 * 1024, "120-min video estimated ~1.2GB");

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
