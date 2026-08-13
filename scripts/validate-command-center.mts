/**
 * Dry-run the Teacher Command Center against real data and print the counts
 * plus the evidence behind every flag.
 *
 * This exists so the numbers are checked against production-like data *before*
 * any UI is built on top of them — a dashboard that confidently displays a wrong
 * count is worse than no dashboard.
 *
 *   npm run validate:command-center                 # every teacher, summary
 *   npm run validate:command-center -- --teacher=<id>
 *   npm run validate:command-center -- --full       # print evidence for each flag
 *   npm run validate:command-center -- --limit=5
 *
 * Read-only: it computes and prints, and writes nothing.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: false });

process.env.JWT_SECRET ??= "validation-script-placeholder-secret-32chars";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const has = (name: string) => args.includes(`--${name}`);

const teacherFilter = flag("teacher");
const limit = Number(flag("limit") ?? 20);
const showFull = has("full");

async function main() {
  const { prisma } = await import("../src/lib/prisma.ts");
  const { buildCommandCenter, getActiveThresholds } = await import(
    "../src/services/teacher/CommandCenterService.ts"
  );

  const thresholds = await getActiveThresholds();
  console.log("Teacher Command Center — validation run");
  console.log(`Thresholds version ${thresholds.version}:`, JSON.stringify(thresholds));
  console.log("");

  const teachers = teacherFilter
    ? await prisma.user.findMany({ where: { id: teacherFilter }, select: { id: true, name: true } })
    : await prisma.user.findMany({
        where: { role: "teacher", isDeleted: false },
        select: { id: true, name: true },
        take: limit,
      });

  if (teachers.length === 0) {
    console.log("No teachers matched.");
    await prisma.$disconnect();
    return;
  }

  const totals = { BEHIND_PACE: 0, DECLINING: 0, INACTIVE: 0, STRUGGLING_TOPIC: 0 };
  let teachersWithRoster = 0;
  const allNotes = new Set<string>();

  for (const teacher of teachers) {
    const started = Date.now();
    const result = await buildCommandCenter(teacher.id);
    const elapsed = Date.now() - started;

    if (result.rosterSize > 0) teachersWithRoster++;
    for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += result.counts[k];
    result.notes.forEach((n) => allNotes.add(n));

    // Only print teachers with something to show, unless explicitly filtered.
    const flagged = result.students.length;
    if (flagged === 0 && !teacherFilter) continue;

    console.log(
      `${teacher.name} (${teacher.id}) — roster ${result.rosterSize}, flagged ${flagged}, ${elapsed}ms`
    );
    console.log(
      `  behind ${result.counts.BEHIND_PACE} | declining ${result.counts.DECLINING} | ` +
        `inactive ${result.counts.INACTIVE} | struggling ${result.counts.STRUGGLING_TOPIC}`
    );

    if (showFull) {
      for (const student of result.students) {
        console.log(`  - ${student.studentName} (${student.studentId})`);
        for (const f of student.flags) {
          console.log(`      [${f.status}] ${f.rule}`);
          console.log(`        evidence: ${JSON.stringify(f.evidence)}`);
          console.log(`        action:   ${f.recommendation}`);
        }
      }
    }
    console.log("");
  }

  console.log("─".repeat(70));
  console.log(`Teachers examined:      ${teachers.length}`);
  console.log(`With a non-empty roster:${String(teachersWithRoster).padStart(4)}`);
  console.log(`Flags — behind ${totals.BEHIND_PACE}, declining ${totals.DECLINING}, inactive ${totals.INACTIVE}, struggling ${totals.STRUGGLING_TOPIC}`);

  if (allNotes.size > 0) {
    console.log("\nSignals that could not be evaluated:");
    for (const n of allNotes) console.log(`  - ${n}`);
  }

  const totalFlags = Object.values(totals).reduce((a, b) => a + b, 0);
  if (totalFlags === 0) {
    console.log(
      "\nNo flags produced. Before assuming the rules are wrong, check whether the\n" +
        "underlying activity tables actually contain data — on a content-only snapshot\n" +
        "(no watch sessions, no quiz answers) every rule correctly produces zero."
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
