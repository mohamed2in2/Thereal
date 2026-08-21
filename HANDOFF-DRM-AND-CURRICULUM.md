# Handoff — DRM hardening + watch-limit requests (and curriculum RAG)

State as of this document: **typecheck clean**, nothing committed, no migration applied.
`git status` shows 7 modified files and 4 new paths (inventory at the bottom).

---

## PART A — Curriculum RAG (COMPLETE, untracked)

Working and tested. Ingests the two official Egyptian Baccalaureate PDFs into a
retrieval knowledge base wired into `AIEngine`.

- Pipeline: `scripts/curriculum/` (`arabic_pdf.py`, `clean.py`, `markers.py`,
  `structure.py`, `chunk.py`, `ingest.py`, `embed.mjs`, `test-retrieval.ts`).
- Output: `src/ai/knowledge/curriculum/curriculum_chunks.json` (479 chunks),
  `curriculum_structure.json`, `curriculum_vectors.json` (479 vectors, 3.3MB).
- Run: `npm run curriculum:build`. See `scripts/curriculum/README.md`.
- Tests: 14/14 questions retrieve the correct lesson; 9/9 prompt-integration checks.

**Why the extractor is custom** (do not "simplify" it back to `get_text()`):
`page.get_text()` DROPS every Arabic letter carrying a diacritic
(`عامًا` → `عاًا`) and emits glyphs in visual order
(`الاجتماعي` → `االجتماعي`). It uses `get_texttrace()` plus geometric RTL
reconstruction instead.

**Action needed:** `curriculum_vectors.json` must be committed, or production
silently degrades to lexical-only retrieval.

---

## PART B — DRM (IN PROGRESS)

### B1. Fixed here, uncommitted

**`src/lib/axinom.ts` — the reason playback could never work.**
The token emitted `{ id: <32-hex>, key: <32-hex> }`. Ground truth (decode the
Axinom reference token embedded in that same file) is `encrypted_key` — base64,
one 16-byte AES block — and a **dashed GUID** `id`. Now emits the correct shape.
Also: a missing `AXINOM_COMMUNICATION_KEY` now throws instead of signing with an
all-zero key; TTL reduced 4h to 2h.

**Tiered L1/L3 DRM** (explicit request: "make L1 and L3 work together")

- `scripts/encrypt-video.js` transcodes 480p + 1080p and packages them under
  **separate content keys** via Shaka Packager `drm_label`. Audio rides the SD
  key. Falls back to single-key if ffmpeg is absent; `--single-key` opts out.
- `axinom.ts` emits both keys with `usage_policy` plus
  `content_key_usage_policies`: `hw-secure` (PlayReady 3000 / Widevine
  `HW_SECURE_ALL`) for the HD key, `sw-secure` (PlayReady 2000 /
  `SW_SECURE_DECODE`) for the SD key.
- Net effect: L1 gets 1080p, L3 gets 480p only. Nobody is locked out, and an L3
  capture only ever yields SD.

**`src/components/ui/DrmPlayer.tsx`**

- Locks to a black overlay on CDM key status `output-restricted` /
  `output-downscaled`. **Critical subtlety:** it locks only when NO key is
  usable. With tiered keys an L3 device is *legitimately* refused the HD key, so
  locking on "any restricted" would black-screen every desktop user. Do not
  simplify that condition.
- Blocks AirPlay/remote playback and picture-in-picture.
- `NEXT_PUBLIC_DRM_REQUIRE_HARDWARE=true` means hardware-or-nothing (blocks most
  desktop Chrome). Leave UNSET for tiering.

**`src/app/courses/[id]/watch/[videoId]/page.tsx` — security fix.**
Removed the student-facing "مشغل Drive المباشر" toggle. It set both `disabled`
on `VideoGuard` and `noNativeSecurity` on `SecurePlayer`, letting any student
switch off all protection with one click. `directDriveMode` is now a hard
`false`.

### B2. NOT verified — needs a real environment

Neither `ffmpeg`, `ffprobe`, nor `packager` is installed on the dev machine, and
the DB is unreachable (pgbouncer at 127.0.0.1:6432). Therefore:

- Tiered packaging has **never executed**. Confirm Shaka Packager accepts the
  `drm_label` descriptors as written.
- Confirm the Axinom tenant honours the Widevine `device_security_level` field
  name. PlayReady's `min_device_security_level` is confirmed by the reference
  token; the Widevine half was patterned on their schema and is unverified.
  **If Axinom rejects the token, check that field first.**
- The `output-restricted` lock has not been exercised against a real recorder.

### B3. Still open in DRM

1. `axinom.ts` hardcodes real-looking tenant defaults (`a85ddc8b-…`) for
   `tenantId` / `communicationKeyId` / `keySeedId` / license URLs. Missing env
   silently points at a specific tenant. Should be required, not defaulted.
2. The `try`/`catch` around the inline-key block swallows key-format errors and
   falls back to `key_seed`, reproducing the same opaque failure.
3. `clearKeys` plumbing runs `SecurePlayer` to `DrmPlayer`. Today only the public
   Axinom demo key feeds it, but ClearKey ships the content key to the browser in
   plaintext. Guard it so it can never carry real content.
4. Pre-existing lint in `axinom.ts` (deliberate lazy `require("node:fs")` to keep
   `fs` out of the client bundle). Leave unless bundling is verified.

---

## PART C — Watch limits + view requests (HALF DONE)

### C1. Done

**`prisma/schema.prisma`** — new `VideoViewRequest` model (student, video,
reason, status, grantedViews, teacher, notes, reviewedAt). Grants are **per
student per video**; approving one student must never widen
`Video.maxWatchesPerUser`, which is global.

**`prisma/migrations/20260821000000_add_video_view_requests/migration.sql`**
Includes a **partial unique index** —
`UNIQUE (studentId, videoId) WHERE status = 'pending'` — so parallel submissions
cannot create two open requests, while approved/rejected rows accumulate as
history and repeat grants stay possible. Prisma cannot express this
declaratively, which is why it is raw SQL.
**NOT APPLIED — run `npx prisma migrate deploy`.**

**`src/lib/watch-allowance.ts`** — `getWatchAllowance()` / `getGrantedViews()`.
Allowance = `Video.maxWatchesPerUser` + sum of approved `grantedViews`.

**`src/app/api/videos/[id]/watch/route.ts`** — all four quota sites now use the
helper. In the atomic consumption path the grant is read **inside** the
Serializable transaction, so a request approved mid-flight is honoured.

**`src/app/api/videos/[id]/view-request/route.ts`** — student GET (status) and
POST (create). Guards: students only; must have video access; must have actually
exhausted the allowance; max 3 rejections; P2002 maps to 409.

**`src/app/api/admin/view-requests/route.ts`** — teacher GET (list +
pendingCount) and PATCH (approve/reject). `ownershipFilter()` scopes teachers to
their own courses; the PATCH `updateMany` is scoped by ownership AND
`status: "pending"`, so two reviewers cannot both resolve one row. Grant clamped
1..20 and rejected loudly rather than silently clamped.

### C2. NOT DONE — pick up here

1. **Teacher panel UI section** — nothing built yet. Add a section to
   `src/app/adminpanel/teacher/page.tsx` listing pending requests with
   approve/reject plus a grant-count input, calling `/api/admin/view-requests`.
   Follow the existing card/section styling. Note the file is ~3400 lines.
2. **Student UI** — when the watch API returns `code: "NO_WATCHES_REMAINING"`,
   show a "request more views" button calling
   `POST /api/videos/[id]/view-request`, and reflect pending state from the GET.
   The 403 branch is at the end of `src/app/api/videos/[id]/watch/route.ts`.
3. **Notifications** — notify the teacher on a new request and the student on
   approval. A `Notification` model already exists.
4. **Verify playback actually works** — the first ask of this round, still
   unconfirmed. Needs a live run.

---

## Deep-audit status

A deep vulnerability check was requested on everything touched. Verified clean:
`verifyDrmPassword` (fails closed, `timingSafeCompare`), the DRM route's
`path.resolve` plus containment check, and the teacher DRM gate (server-enforced
on both the gate route and the create route).

Not yet audited: the rest of `src/app/adminpanel/teacher/page.tsx`, and
`src/app/preview/drm/page.tsx` (who can reach it?).

---

## File inventory

Modified: `.env.example`, `prisma/schema.prisma`, `scripts/encrypt-video.js`,
`src/app/api/videos/[id]/watch/route.ts`,
`src/app/courses/[id]/watch/[videoId]/page.tsx`,
`src/components/ui/DrmPlayer.tsx`, `src/lib/axinom.ts`

New: `prisma/migrations/20260821000000_add_video_view_requests/`,
`src/app/api/admin/view-requests/`, `src/app/api/videos/[id]/view-request/`,
`src/lib/watch-allowance.ts`, `scripts/curriculum/`,
`src/ai/knowledge/curriculum/`

Also uncommitted from earlier: `src/ai/AIEngine.ts`,
`src/ai/prompts/PromptBuilder.ts`, `src/ai/types/index.ts`, `package.json`,
`.gitignore` (curriculum RAG wiring).
