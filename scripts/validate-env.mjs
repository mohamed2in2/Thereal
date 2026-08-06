/**
 * Validates required environment variables for this project.
 * Run: node scripts/validate-env.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(filename) {
  const path = join(root, filename);
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const merged = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const skipTwilioValidation = merged.TWILIO_BYPASS_VERIFICATION === "true";

const REQUIRED = [
  {
    key: "DATABASE_URL",
    test: (v) => {
      if (v.startsWith("file:") || v.startsWith("libsql:")) return true;
      return (
        (v.startsWith("postgresql://") || v.startsWith("postgres://")) &&
        !/YOUR_DB_PASSWORD|USER:PASSWORD|replace-me/i.test(v)
      );
    },
    hint: "Use file:./dev.db (local) or a real Supabase PostgreSQL URI",
  },
  {
    key: "JWT_SECRET",
    test: (v) => v.length >= 16 && !/replace-with|your-secret|change-me/i.test(v),
    hint: "At least 16 characters; not a placeholder",
  },
  ...(skipTwilioValidation
    ? []
    : [
        {
          key: "TWILIO_ACCOUNT_SID",
          test: (v) => /^AC[0-9a-fA-F]{32}$/.test(v),
          hint: "Twilio account SID (starts with AC...)",
        },
        {
          key: "TWILIO_AUTH_TOKEN",
          test: (v, merged) => {
            // Accept either the classic account auth token or an API key pair
            if (v && v.length >= 24) return true;
            if (merged.TWILIO_API_KEY_SID && merged.TWILIO_API_SECRET) return true;
            return false;
          },
          hint: "Twilio Auth Token OR set TWILIO_API_KEY_SID & TWILIO_API_SECRET (preferred)",
        },
        {
          key: "TWILIO_FROM_NUMBER",
          test: (v) => /^\+?[1-9]\d{7,14}$/.test(v.replace(/\s+/g, "")),
          hint: "Twilio sender number in E.164 format, e.g. +201XXXXXXXXX",
        },
      ]),
];

const RECOMMENDED = [
  "NEXT_PUBLIC_SITE_URL",
];

let failed = 0;

console.log("Environment validation\n");

const envFiles = [".env", ".env.local"].filter((f) => existsSync(join(root, f)));
if (envFiles.length === 0) {
  console.error("No .env or .env.local file found.");
  console.error("Copy .env.example to .env and fill in your values.\n");
  process.exit(1);
}

console.log(`Loaded: ${envFiles.join(", ")}\n`);

for (const { key, test, hint } of REQUIRED) {
  const value = merged[key]?.trim() ?? "";
  if (!value) {
    console.error(`MISSING: ${key}`);
    console.error(`         ${hint}\n`);
    failed++;
    continue;
  }
  if (!test(value)) {
    console.error(`INVALID: ${key}`);
    console.error(`         ${hint}\n`);
    failed++;
    continue;
  }
  console.log(`OK: ${key}`);
}

for (const key of RECOMMENDED) {
  const value = merged[key]?.trim() ?? "";
  if (!value) {
    console.warn(`WARN: ${key} is not set (optional but recommended)`);
  }
}

if (merged.DATABASE_URL?.includes("file:")) {
  const sqlitePath = merged.DATABASE_URL.replace(/^file:/, "");
  if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(sqlitePath)) {
    console.warn(
      "\nWARN: DATABASE_URL points to a Windows SQLite path on a non-Windows system. Use file:./prisma/dev.db instead."
    );
  } else {
    console.log("\nOK: DATABASE_URL is using SQLite for local development.");
  }
}

if (failed > 0) {
  console.error(`\n${failed} required variable(s) need fixing. See .env.example`);
  process.exit(1);
}

console.log("\nAll required environment variables look good.");
