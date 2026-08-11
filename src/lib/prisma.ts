import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DB connection, cross-platform.
 *
 * - Local dev (Windows / SQLite, DATABASE_URL="file:..."): Attempts libSQL driver adapter
 *   for CWD resolution, falling back to standard PrismaClient if native binary is unavailable.
 * - Prod (Linux / Postgres, DATABASE_URL="postgres..."): standard PrismaClient.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    try {
      const { PrismaLibSql } = require("@prisma/adapter-libsql");
      return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
    } catch {
      return new PrismaClient();
    }
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
