import path from "node:path";
import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolves a relative SQLite `file:` URL the way the Prisma CLI does — relative
 * to the schema directory (`prisma/`), not to the process CWD.
 *
 * This matters because the two disagreed. `prisma migrate` / `prisma db execute`
 * anchor `file:./dev.db` at prisma/schema.prisma, so migrations land in
 * `prisma/dev.db`; the libSQL adapter anchored the same URL at `process.cwd()`,
 * so the running app opened `./dev.db` in the repo root instead. The result was
 * two divergent databases, with the `catch` below silently choosing between them
 * depending on whether the native driver happened to load. Anchoring explicitly
 * keeps the app and the CLI on one file.
 */
function resolveSqliteUrl(url: string): string {
  if (!url.startsWith("file:")) return url;

  const raw = url.slice("file:".length);
  if (path.isAbsolute(raw) || raw.startsWith("/")) return url;

  return `file:${path.join(process.cwd(), "prisma", raw)}`;
}

/**
 * DB connection, cross-platform.
 *
 * - Local dev (Windows / SQLite, DATABASE_URL="file:..."): uses the libSQL driver
 *   adapter, falling back to the standard PrismaClient if the native binary is
 *   unavailable. Both now open the same file.
 * - Prod (Linux / Postgres, DATABASE_URL="postgres..."): standard PrismaClient.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.startsWith("libsql:")) {
    try {
      const { PrismaLibSql } = require("@prisma/adapter-libsql");
      return new PrismaClient({ adapter: new PrismaLibSql({ url: resolveSqliteUrl(url) }) });
    } catch {
      return new PrismaClient();
    }
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
