/**
 * Backfill SEO slugs for existing courses that don't have one yet.
 * Safe to run repeatedly (only touches rows where slug IS NULL).
 * Reads DATABASE_URL from .env — works on local SQLite (libSQL adapter) and on
 * prod Postgres (plain client), mirroring src/lib/prisma.ts.
 *
 *   npx tsx scripts/backfill-course-slugs.mjs
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCourseSlug } from "../src/lib/course-slug";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  let prisma;
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  } else {
    prisma = new PrismaClient();
  }

  const courses = await prisma.course.findMany({
    where: { slug: null },
    select: { id: true, subject: true, educationalStage: true },
  });

  let n = 0;
  for (const c of courses) {
    let slug = buildCourseSlug(c);
    try {
      await prisma.course.update({ where: { id: c.id }, data: { slug } });
    } catch {
      // Extremely unlikely slug collision — disambiguate with a longer id tail.
      slug = `${slug}-${c.id.slice(-10)}`;
      await prisma.course.update({ where: { id: c.id }, data: { slug } });
    }
    n++;
  }

  console.log(`✅ Backfilled ${n} course slug(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Backfill failed:", e.message);
  process.exit(1);
});
