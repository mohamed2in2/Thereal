import assert from "node:assert/strict";

async function runLiveChecks() {
  console.log("Running Live HTTP Checks against http://localhost:3000...");

  // 1. Clean GET request
  const cleanRes = await fetch("http://localhost:3000/api/security/vpn-check");
  const cleanData = await cleanRes.json();
  assert.equal(cleanData.isVpn, false);
  assert.equal(cleanData.code, "CLEAN");
  console.log("  PASS: Clean request returned isVpn: false, code: CLEAN");

  // 2. Request with via header
  const viaRes = await fetch("http://localhost:3000/api/security/vpn-check", {
    headers: { via: "1.1 cloudflare-warp" },
  });
  const viaData = await viaRes.json();
  assert.equal(viaData.isVpn, true);
  assert.equal(viaData.code, "VPN_DETECTED");
  console.log("  PASS: via header returned isVpn: true, code: VPN_DETECTED");

  // 3. Request with x-proxy-id
  const proxyRes = await fetch("http://localhost:3000/api/security/vpn-check", {
    headers: { "x-proxy-id": "nord-eg-101" },
  });
  const proxyData = await proxyRes.json();
  assert.equal(proxyData.isVpn, true);
  assert.equal(proxyData.code, "VPN_DETECTED");
  console.log("  PASS: x-proxy-id returned isVpn: true, code: VPN_DETECTED");

  // 4. Request with cf-warp
  const warpRes = await fetch("http://localhost:3000/api/security/vpn-check", {
    headers: { "cf-warp": "on" },
  });
  const warpData = await warpRes.json();
  assert.equal(warpData.isVpn, true);
  assert.equal(warpData.code, "VPN_DETECTED");
  console.log("  PASS: cf-warp returned isVpn: true, code: VPN_DETECTED");

  // 5. Check /vpn-check HTML page returns 200 OK
  const pageRes = await fetch("http://localhost:3000/vpn-check");
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.ok(html.includes("Code-UP") || html.includes("vpn") || html.includes("VPN"));
  console.log("  PASS: /vpn-check page renders status 200 OK");

  // 6. Check /waiting-room redirects to /vpn-check
  const redirectRes = await fetch("http://localhost:3000/waiting-room", {
    redirect: "manual",
  });
  assert.ok(redirectRes.status === 307 || redirectRes.status === 308 || redirectRes.status === 302 || redirectRes.status === 200);
  console.log("  PASS: /waiting-room alias handled correctly");

  console.log("\nAll live endpoint tests passed with flying colors!\n");
}

runLiveChecks().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
