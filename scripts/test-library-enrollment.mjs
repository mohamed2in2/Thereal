/**
 * Integration test: code redeem → library enrolled list
 * Run: node scripts/test-library-enrollment.mjs
 * Requires dev server on localhost:3000
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  // 1) Find an unused code in DB via admin-less approach: use enrolled + courses public
  const coursesRes = await fetch(`${BASE}/api/courses`);
  const coursesData = await coursesRes.json();
  const courses = coursesData.courses || [];
  if (!courses.length) {
    console.error("FAIL: No courses in database");
    process.exit(1);
  }
  console.log(`Found ${courses.length} course(s)`);

  // Without auth we cannot redeem; test enrolled returns 401 not 403 for anonymous
  const anonEnrolled = await fetch(`${BASE}/api/courses/enrolled`, { cache: "no-store" });
  if (anonEnrolled.status !== 401) {
    console.error(`FAIL: Anonymous enrolled should be 401, got ${anonEnrolled.status}`);
    process.exit(1);
  }
  console.log("OK: Anonymous /api/courses/enrolled → 401");

  console.log("\nManual check (browser):");
  console.log("1. Sign in as STUDENT via Clerk (not teacher admin panel)");
  console.log("2. If you used admin panel before, click Sign out on Account page");
  console.log("3. Redeem a code on /courses → course must appear on /library");
  console.log("\nAutomated DB test requires DATABASE_URL — run: npx ts-node scripts/test-enrollment-db.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
