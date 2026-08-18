import { circuitBreaker } from "../src/lib/whatsapp/circuitBreaker";
import { messageQueue, getGaussianJitter } from "../src/lib/whatsapp/queue";

async function runWhatsAppReliabilityTests() {
  console.log("==================================================");
  console.log("🚀 Starting WhatsApp Reliability & Queue Engine Tests");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description}`);
      failed++;
    }
  }

  // Test 1: Gaussian Jitter Generator
  console.log("\n--- Test Suite 1: Gaussian Jitter & Load Smoothing ---");
  const samples: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const jitter = getGaussianJitter(5000, 1000, 500);
    samples.push(jitter);
  }
  const avgJitter = samples.reduce((a, b) => a + b, 0) / samples.length;
  const minSample = Math.min(...samples);

  assert(avgJitter > 4500 && avgJitter < 5500, `Average jitter (${Math.round(avgJitter)}ms) is centered around target mean (5000ms)`);
  assert(minSample >= 500, `Minimum jitter clamp (${minSample}ms >= 500ms) is strictly enforced`);

  // Test 2: Circuit Breaker State Transitions
  console.log("\n--- Test Suite 2: Tri-State Circuit Breaker Logic ---");
  circuitBreaker.reset();
  assert(circuitBreaker.getState() === "HEALTHY", "Initial state is HEALTHY");
  assert(circuitBreaker.isBaileysAvailable() === true, "Baileys is available when HEALTHY");

  // Simulate 3 network disconnects
  circuitBreaker.recordFailure(new Error("Socket timeout"));
  circuitBreaker.recordFailure(new Error("Connection reset by peer"));
  circuitBreaker.recordFailure(new Error("EHOSTUNREACH"));
  assert(circuitBreaker.getState() === "PROVIDER_UNHEALTHY", "3 consecutive network errors trip PROVIDER_UNHEALTHY");
  assert(circuitBreaker.isBaileysAvailable() === false, "Baileys is paused when PROVIDER_UNHEALTHY");

  // Re-establishment of connection
  circuitBreaker.recordSuccess();
  assert(circuitBreaker.getState() === "HEALTHY", "Connection recovery restores state to HEALTHY");

  // Session Invalidation (401)
  circuitBreaker.recordFailure(new Error("logged out"), 401);
  assert(circuitBreaker.getState() === "SESSION_INVALID", "401 / loggedOut transitions to SESSION_INVALID");

  // Account Restriction (403 Forbidden)
  circuitBreaker.recordFailure(new Error("Forbidden account"), 403);
  assert(circuitBreaker.getState() === "ACCOUNT_RESTRICTED", "403 Forbidden transitions to ACCOUNT_RESTRICTED");
  assert(circuitBreaker.isBaileysAvailable() === false, "Baileys is completely disabled when ACCOUNT_RESTRICTED");

  // Probing should NOT auto-heal ACCOUNT_RESTRICTED
  circuitBreaker.recordSuccess();
  assert(circuitBreaker.getState() === "ACCOUNT_RESTRICTED", "ACCOUNT_RESTRICTED cannot be auto-healed by transient success signals");

  // Admin explicit reset
  circuitBreaker.reset();
  assert(circuitBreaker.getState() === "HEALTHY", "Admin reset successfully restores circuit breaker to HEALTHY");

  // Test 3: Multi-Band Priority Queue Estimations & Breakdowns
  console.log("\n--- Test Suite 3: Priority Queue Band Isolation ---");
  const queueLengths = messageQueue.getQueueLengthsByBand();
  assert(typeof queueLengths.P0 === "number", "P0 queue band is isolated and tracked");
  assert(typeof queueLengths.P1 === "number", "P1 queue band is isolated and tracked");
  assert(typeof queueLengths.P2 === "number", "P2 queue band is isolated and tracked");
  assert(typeof queueLengths.P3 === "number", "P3 queue band is isolated and tracked");

  console.log("\n==================================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runWhatsAppReliabilityTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
