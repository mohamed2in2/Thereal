# `src/ai` reachability inventory — 2026-08-13

Produced before any deletion, so the decision to remove code is made from evidence
rather than from a single grep.

## Headline

- **141 TypeScript files, ~10,060 lines.**
- **Zero of them reference `prisma`.** The entire subsystem is in-memory; it cannot
  read a student, course, lesson or quiz result.
- Only a small set is reachable from application code. The learning-relevant
  modules are not.

## Reachable from routes/services

These are imported directly by `src/app`, `src/services` or `src/lib` and are live:

```
@/ai/AIEngine
@/ai/admin/audit_logging/AIAuditSystem
@/ai/admin/budget/BudgetTracker
@/ai/admin/config/AIOperationsConfig
@/ai/admin/cost_analytics/CostManager
@/ai/admin/dashboard/LiveAIDashboard
@/ai/admin/monitoring/GeminiClusterDashboard
@/ai/admin/monitoring/ProviderMonitor
@/ai/config/AIConfig
@/ai/memory/MemoryManager
@/ai/telemetry/Telemetry
@/ai/types
```

## Unreachable

`learning_graph`, `recommendations`, `rag`, `knowledge`.

Verified against every mechanism that could hide a dependency:

| Check | Result |
|---|---|
| Static imports from outside `src/ai` | none |
| Dynamic `import()` | none |
| `require()` | none |
| Referenced by `scripts/` | none |
| Referenced by `docs/` or root `*.md` | none |
| Filesystem/glob loading | none |
| Reachable via the `src/ai/index.ts` barrel | barrel exists, but **is itself imported nowhere** |

> A first pass appeared to show `rag` referenced by 3 scripts and 4 docs, and
> `recommendations` by 2 scripts. Those were substring false positives — "rag"
> matches *ave**rag**e* and *sto**rag**e*. Path-qualified matching
> (`ai/<module>/`) returns zero. This is exactly the trap that makes
> "zero imports, deleted!" dangerous.

## Why these are not safe to wire as-is

`learning_graph/LearningGraph.ts` (91 lines) hardcodes four fictional lessons in
its constructor — `lsn_101`…`lsn_104`, "المتغيرات وأنواع البيانات" etc. — with no
persistence and no link to the real `Video`/`Folder`/`Course` tables.

Critically, `checkPrerequisites()` returns:

```ts
const node = this.getNode(lessonId);
if (!node) return { satisfied: true, missingPrerequisites: [] };
```

Every real lesson id is absent from the seeded map, so wiring this into lesson
gating would **fail open for 100% of real content**. It is a design sketch, not
an implementation.

`recommendations/RecommendationEngine.ts` (66 lines) and the `rag/*` files are of
the same character.

## Recommendation

Do **not** delete file-by-file as a side effect of other work. Either:

1. **One intentional cleanup commit** that removes `src/ai/learning_graph`,
   `src/ai/recommendations`, `src/ai/rag`, `src/ai/knowledge` and the unused
   `src/ai/index.ts` barrel, with this document referenced in the message; or
2. **Move them to `src/ai/_sketches/`** with a README stating they are unwired
   design sketches with no database access.

Option 2 is preferable if the interfaces are still wanted as a starting point for
the real Mastery System. What must not persist is production-looking code, in a
production path, that has never run — it misleads every future reader and
enlarges the audit surface for no benefit.

Whichever is chosen, run `npx tsc --noEmit` and `npx next build` afterwards: the
barrel re-exports these modules, so removing them without removing the barrel
will fail the build.
