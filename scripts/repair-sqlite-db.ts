import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const FALLBACK_SQLITE_URL = 'file:./prisma/dev.db';

function resolveDatabaseUrl(rawUrl: string): string | null {
  const dbUrl = rawUrl.trim();
  if (!dbUrl) return null;

  if (!dbUrl.startsWith('file:')) {
    return null;
  }

  const sqlitePath = dbUrl.slice('file:'.length);
  if (process.platform !== 'win32' && /^[A-Za-z]:[\\/]/.test(sqlitePath)) {
    return FALLBACK_SQLITE_URL;
  }

  return dbUrl;
}

async function ensureSQLiteSchema(prisma: PrismaClient) {
  const tableRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tableNames = new Set(tableRows.map((row) => row.name));

  const courseColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info('Course')");
  const courseColumnNames = new Set(courseColumns.map((column) => column.name));

  const operations: string[] = [];

  if (!courseColumnNames.has('maxWatchCount')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Course" ADD COLUMN "maxWatchCount" INTEGER NOT NULL DEFAULT 3'
    );
    operations.push('added Course.maxWatchCount');
  }

  if (!courseColumnNames.has('homeworkUrl')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Course" ADD COLUMN "homeworkUrl" TEXT');
    operations.push('added Course.homeworkUrl');
  }

  if (!tableNames.has('VideoWatchSession')) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "VideoWatchSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionToken" TEXT NOT NULL,
        "videoId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" DATETIME NOT NULL,
        "endedAt" DATETIME,
        "usedWatchSlot" BOOLEAN NOT NULL DEFAULT true,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        CONSTRAINT "VideoWatchSession_videoId_fkey"
          FOREIGN KEY ("videoId") REFERENCES "Video" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX "VideoWatchSession_sessionToken_key" ON "VideoWatchSession"("sessionToken")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX "VideoWatchSession_videoId_idx" ON "VideoWatchSession"("videoId")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX "VideoWatchSession_studentId_idx" ON "VideoWatchSession"("studentId")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX "VideoWatchSession_sessionToken_idx" ON "VideoWatchSession"("sessionToken")'
    );
    operations.push('created VideoWatchSession');
  }

  // Migrate old plan stages to standard codes
  try {
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "educationalStage" = 'sec_1' WHERE "educationalStage" = 'FIRST_SECONDARY'`);
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "educationalStage" = 'sec_2' WHERE "educationalStage" = 'SECOND_SECONDARY'`);
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "educationalStage" = 'sec_3' WHERE "educationalStage" = 'THIRD_SECONDARY'`);
    operations.push('migrated Plan.educationalStage to standard codes');
  } catch (e) {
    // Plan table might not exist in some environments yet
  }

  return operations;
}

async function main() {
  const dbUrl = resolveDatabaseUrl(process.env.DATABASE_URL ?? '');
  if (!dbUrl) {
    console.log('[repair-db] DATABASE_URL missing or non-sqlite; skipping local repair');
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });

  try {
    const operations = await ensureSQLiteSchema(prisma);
    if (operations.length === 0) {
      console.log('[repair-db] SQLite schema already up to date');
    } else {
      console.log(`[repair-db] Applied: ${operations.join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[repair-db] Failed to repair SQLite schema:', error);
  process.exit(1);
});
