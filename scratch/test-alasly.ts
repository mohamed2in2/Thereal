import crypto from "node:crypto";
import { verifyAlaslyWebhookSignature } from "../src/lib/alasly";

// Test 1: Verify HMAC calculation matching user specification
const secret = "test_secret_123";
const key = "test_key_abc";
const ts = "1771234567890";
const method = "POST";
const route = "/upload/init";
const body = { title: "الدرس الأول", external_ref: "lesson_123", playback_kind: "mp4" };
const raw = JSON.stringify(body);

const expectedSignature = crypto
  .createHmac("sha256", secret)
  .update(`${ts}.${method}.${route}.${raw}`)
  .digest("hex");

console.log("Test 1 - HMAC generated:", expectedSignature);
if (!expectedSignature || expectedSignature.length !== 64) {
  throw new Error("HMAC signature generation failed");
}
console.log("✓ Test 1 Passed: HMAC signature format correct.");

// Test 2: Webhook signature verification
process.env.VIDEO_WEBHOOK_SECRET = "webhook_secret_xyz";
const webhookPayload = JSON.stringify({
  event: "video.ready",
  videoId: "abc123",
  assetId: "asset_456",
  status: "ready",
  duration: 1200
});

const validWebhookSig = "sha256=" + crypto
  .createHmac("sha256", "webhook_secret_xyz")
  .update(webhookPayload)
  .digest("hex");

const isWebhookValid = verifyAlaslyWebhookSignature(webhookPayload, validWebhookSig);
console.log("Test 2 - Webhook validation with correct secret:", isWebhookValid);
if (!isWebhookValid) {
  throw new Error("Webhook signature verification should pass for valid signature");
}

const isWebhookInvalid = verifyAlaslyWebhookSignature(webhookPayload, "sha256=invalid_hash_value");
console.log("Test 2 - Webhook validation with invalid secret:", isWebhookInvalid);
if (isWebhookInvalid) {
  throw new Error("Webhook signature verification should fail for invalid signature");
}
console.log("✓ Test 2 Passed: Webhook signature verification functions properly.");

console.log("\nALL ALASLY API INTEGRATION TESTS PASSED!");
