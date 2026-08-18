import assert from "node:assert/strict";
import { isVpnOrProxy, getClientIp } from "../src/lib/vpn-guard";

async function testVpnGuardHeuristics() {
  console.log("Testing VPN & Proxy Detection Heuristics...");

  // 1. Clean connection
  const cleanHeaders = new Headers({
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "x-forwarded-for": "197.34.56.78",
  });
  const cleanResult = isVpnOrProxy(cleanHeaders);
  assert.equal(cleanResult.isVpn, false, "Clean connection must not be flagged as VPN");
  assert.equal(cleanResult.ip, "197.34.56.78", "IP should match x-forwarded-for");
  console.log("  PASS: Clean connection recognized correctly");

  // 2. Via header (Squid, WARP, etc.)
  const viaHeaders = new Headers({
    via: "1.1 warp.cloudflare.com",
    "x-forwarded-for": "104.28.245.12",
  });
  const viaResult = isVpnOrProxy(viaHeaders);
  assert.equal(viaResult.isVpn, true, "Via header must trigger VPN detection");
  assert.ok(viaResult.reason?.includes("Via"), "Reason must mention Via header");
  console.log("  PASS: Via proxy header detected");

  // 3. x-proxy-id
  const proxyIdHeaders = new Headers({
    "x-proxy-id": "nord-eg-102",
  });
  const proxyIdResult = isVpnOrProxy(proxyIdHeaders);
  assert.equal(proxyIdResult.isVpn, true, "x-proxy-id must trigger VPN detection");
  console.log("  PASS: x-proxy-id detected");

  // 4. Cloudflare WARP / x-warp
  const warpHeaders = new Headers({
    "cf-warp": "on",
    "x-forwarded-for": "8.8.8.8",
  });
  const warpResult = isVpnOrProxy(warpHeaders);
  assert.equal(warpResult.isVpn, true, "cf-warp must trigger VPN detection");
  console.log("  PASS: Cloudflare WARP detected");

  // 5. Multi-hop proxy chaining (>2 hops)
  const multiHopHeaders = new Headers({
    "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
  });
  const multiHopResult = isVpnOrProxy(multiHopHeaders);
  assert.equal(multiHopResult.isVpn, true, "Multi-hop proxy chain must trigger VPN detection");
  console.log("  PASS: Multi-hop proxy chaining detected");

  // 6. Proxy-Connection
  const proxyConnHeaders = new Headers({
    "proxy-connection": "keep-alive",
  });
  const proxyConnResult = isVpnOrProxy(proxyConnHeaders);
  assert.equal(proxyConnResult.isVpn, true, "Proxy-Connection must trigger VPN detection");
  console.log("  PASS: Proxy-Connection header detected");

  // 7. IP extraction fallbacks
  const realIpHeaders = new Headers({
    "x-real-ip": "156.204.12.99",
  });
  assert.equal(getClientIp(realIpHeaders), "156.204.12.99", "x-real-ip extraction should succeed");
  console.log("  PASS: getClientIp extracted real-ip accurately");

  console.log("\nAll 7 VPN Detection unit tests passed successfully!\n");
}

testVpnGuardHeuristics().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
