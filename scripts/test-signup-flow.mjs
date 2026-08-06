/**
 * Smoke test for signup flow modules (no server required).
 * Run: node scripts/test-signup-flow.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const checks = [
  {
    name: "Auth callback route exists",
    file: "src/app/auth/callback/page.tsx",
    includes: ["fetchMeWithRetry", "profileCompleted", "/complete-profile"],
  },
  {
    name: "Signup redirects to auth callback",
    file: "src/app/signup/[[...rest]]/page.tsx",
    includes: ["/auth/callback", "SignUp"],
  },
  {
    name: "Login redirects to auth callback (not complete-profile directly)",
    file: "src/app/login/[[...rest]]/page.tsx",
    includes: ["/auth/callback", "SignIn"],
    excludes: ['forceRedirectUrl="/complete-profile"'],
  },
  {
    name: "Complete profile uses EDUCATIONAL_STAGES values",
    file: "src/app/complete-profile/page.tsx",
    includes: ["EDUCATIONAL_STAGES", "stage.value"],
  },
  {
    name: "fetchMeWithRetry helper",
    file: "src/lib/fetch-me.ts",
    includes: ["/api/auth/me", "fetchMeWithRetry"],
  },
];

let failed = 0;

for (const check of checks) {
  const path = join(root, check.file);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    console.error(`FAIL: ${check.name} — missing ${check.file}`);
    failed++;
    continue;
  }

  const missing = (check.includes || []).filter((s) => !content.includes(s));
  const forbidden = (check.excludes || []).filter((s) => content.includes(s));

  if (missing.length === 0 && forbidden.length === 0) {
    console.log(`OK: ${check.name}`);
  } else {
    console.error(`FAIL: ${check.name}`);
    if (missing.length) console.error("  missing:", missing.join(", "));
    if (forbidden.length) console.error("  forbidden:", forbidden.join(", "));
    failed++;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll signup flow smoke checks passed.");
