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
 * Interactive-transaction budget.
 *
 * Prisma's defaults are maxWait 2s / timeout 5s. Both were too tight here: the
 * fulfillment path (`fulfillPendingItemPurchase`) runs a whole PurchaseService
 * call — several dependent writes — inside `prisma.$transaction`, and under load
 * that regularly overran 5s and surfaced as P2028 ("Transaction not found …
 * refers to an old closed transaction"). Callers were losing credited payments
 * to a timeout rather than to any real failure.
 *
 * Setting the budget on the client applies it to all ~34 `$transaction` call
 * sites at once, instead of threading an options object through each one. Sites
 * that already pass explicit options (sync-payments) still win — per-call
 * options override the client default.
 */
const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

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
      return new PrismaClient({
        adapter: new PrismaLibSql({ url: resolveSqliteUrl(url) }),
        transactionOptions: TRANSACTION_OPTIONS,
      });
    } catch {
      return new PrismaClient({ transactionOptions: TRANSACTION_OPTIONS });
    }
  }
  return new PrismaClient({ transactionOptions: TRANSACTION_OPTIONS });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
