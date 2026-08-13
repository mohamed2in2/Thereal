# PostgreSQL migration baseline

`prisma/migrations/` contains SQLite-flavoured SQL (`DATETIME`, inline `PRIMARY KEY`)
and `migration_lock.toml` pins it to `provider = "sqlite"`. Those migrations **cannot
run against PostgreSQL** — `prisma migrate deploy` refuses on a provider mismatch.

This directory holds a single squashed baseline generated from the current schema:

```
00000000000000_init/migration.sql   75 tables, 205 indexes, 89 foreign keys
```

Generated offline with:

```bash
sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > /tmp/schema.pg.prisma
npx prisma migrate diff --from-empty --to-schema-datamodel /tmp/schema.pg.prisma --script \
  > prisma/migrations-postgres/00000000000000_init/migration.sql
```

It reflects the schema **including** the security work from the 2026-08 audit
(`PhoneVerificationChallenge`, `User.failedLoginAttempts`, `User.lockedUntil`).

---

## Cutover runbook

This has **not** been executed. Nothing here changes the running system until you
point `DATABASE_URL` at PostgreSQL.

### 1. Provision and take a backup first

```bash
npm run db:backup          # snapshot the SQLite file before touching anything
```

### 2. Apply the baseline to the new database

```bash
DATABASE_URL="postgresql://…" npx prisma migrate deploy --schema prisma/schema.prisma
```

Swap `prisma/migrations` for `prisma/migrations-postgres` (rename, or point
`--schema` at a copy whose `migrations` directory is this one). `scripts/prisma-generate.js`
already rewrites the schema `provider` from `DATABASE_URL`, so the datamodel needs
no manual edit.

### 3. Move the data

There is no automated exporter yet. 75 tables with 89 foreign keys must be inserted
in dependency order — do not write ad-hoc INSERTs by hand. Use `pgloader`, or a
Prisma script that reads from the SQLite client and writes to the PostgreSQL client
table-by-table in topological order.

**Decide first which SQLite file is authoritative.** As of the audit there were two
divergent ones (`prisma/dev.db`, 129 users, current schema; and a stale root
`dev.db`, 27 users, schema frozen at 2026-08-04). See `SECURITY-AUDIT-2026-08.md` F2.

### 4. Size the connection pool

`ecosystem.config.js` runs PM2 in cluster mode with `instances: "max"`, and each
worker holds its own Prisma pool. Prisma's default pool is `num_physical_cpus * 2 + 1`,
so on a 4-vCPU box that is 4 workers × 9 = **36 connections** — above Supabase's
pooler default for small instances.

Set an explicit limit in the connection string:

```
postgresql://…?connection_limit=5&pool_timeout=20
```

and verify `workers × connection_limit` sits under the provider's ceiling.

### 5. What changes behaviourally on PostgreSQL

These are currently inert on SQLite and become **active** — this is the main reason
to migrate:

| Behaviour | On SQLite today | On PostgreSQL |
|---|---|---|
| `acquireAdvisoryLock()` | no-op (`src/lib/distributed-lock.ts` returns early) | real `pg_advisory_xact_lock`, serialising per-student spending |
| Watch-session quota transaction | default isolation | `Serializable`, with P2034 retry already handled in the route |
| `mode: "insensitive"` (9 call sites) | ignored | active — search becomes genuinely case-insensitive |

### 6. Verify

```bash
npx prisma migrate status
npm run test:security      # 16 tests; the concurrency ones are the point here
curl -s localhost:3000/api/health
```

The concurrency tests are worth re-running against PostgreSQL specifically: on
SQLite they pass because writes serialise at the file level, whereas on PostgreSQL
they exercise the advisory locks and `Serializable` isolation for real.
