import { PrismaClient } from "../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DB connection, cross-platform.
 *
 * - Local dev (Windows / SQLite, DATABASE_URL="file:..."): the `prisma-client`
 *   generator's plain client resolves a relative `file:` path against the wrong
 *   directory and silently hits an EMPTY database (this is what broke login).
 *   Using the libSQL driver adapter resolves the path relative to CWD — the same
 *   way scripts/repair-sqlite-db.ts connects — so the app reads prisma/dev.db.
 * - Prod (Linux / Postgres, DATABASE_URL="postgres..."): the plain client works
 *   as before (absolute URL, no relative-path issue). Left unchanged so the
 *   deployed server's behavior is untouched.
 *
 * The schema provider itself is swapped to match DATABASE_URL by
 * scripts/prisma-generate.js (run on postinstall), so the generated client
 * always matches the target database on each platform.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
