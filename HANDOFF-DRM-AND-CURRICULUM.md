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

### C2. CORRECTION — both UIs already existed

An earlier draft of this document said the teacher and student UIs were missing.
That was wrong. Both are committed and were already calling these endpoints:

- Teacher: `src/components/admin/TeacherRequests.tsx` (the "طلبات المتعلمين"
  section) calls `GET /api/admin/view-requests?status=all` and PATCHes
  `{requestId, action, grantedViews, teacherNotes}`.
- Student: the watch page handles `NO_WATCHES_REMAINING` and calls
  `GET/POST /api/videos/[id]/view-request`.

Both were returning 404 because the APIs did not exist. The APIs built this
session match their payloads field-for-field (verified). **No new UI is needed.**

### Remaining

1. **Notifications** — notify the teacher on a new request and the student on
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

---

# PART D — DRM rewire (REQUESTED, NOT STARTED)

## Read this first: what the evidence already rules out

The user asked to "rewire both DRMs and find what is holding them back."
**Nothing in this codebase is holding VdoCipher back.** Verified empirically:
VdoCipher — which runs in its own `player.vdocipher.com` iframe, with its own
player, license flow and CDM negotiation, and which this platform's CSP does not
govern — captured just as easily as Axinom on the same machine.

That machine's capability probe reported **no hardware DRM in any form**: no
Widevine L1, no PlayReady under either key-system spelling. A browser with no
protected media path composites decoded frames normally regardless of vendor.

**Therefore: do not promise that a rewire makes capture go black.** It will not.
The rewire is worth doing for architecture and honesty, not for capture.

Outstanding control test the user has not yet run: play VdoCipher's own demo on
vdocipher.com (no Code-UP code involved) in the same browser. If that captures
too, the platform is fully exonerated. Also retest on a second Windows machine
with current GPU drivers on Edge — one laptop proves little about the population.

## Scope requested

1. Rewire the Axinom + VdoCipher DRM mechanisms behind one abstraction.
2. "A-Z DRM protection."
3. Delete the existing preview pages, build one professional preview covering
   both providers.

## Before deleting the preview

`/preview/drm` is linked from the teacher panel (the DRM upload flow issues a
2h preview URL from `/api/teacher/drm-package` and `/api/teacher/drm-preview`).
Grep for `preview/drm` before removing anything, or teacher upload breaks.

`/preview/drm-capabilities` is new this session and is the only honest read on
what a given device negotiates — keep it or fold it into the replacement.

## Known DRM state going in

Fixed and verified by typecheck/build this session:
- Axinom token format (`encrypted_key` + dashed GUID; was `key` + hex — nothing
  could ever decrypt)
- CSP now allows `axtest.net` (demo license requests were CSP-blocked)
- Hardware probing prefers Widevine `HW_SECURE_ALL` / PlayReady SL3000, testing
  BOTH `com.microsoft.playready.recommendation.3000` and
  `com.microsoft.playready.recommendation` + robustness "3000"
- Tiered L1/L3 keys: HD key hardware-only, SD key software — an L3 device gets
  480p only
- CDM key-status lock fires only when NO key is usable (locking on "any
  restricted" would black-screen every L3 desktop user — do not "simplify")
- Removed the keydown/blur blackout from BOTH players: `Win+Shift+S` etc. are
  swallowed by the OS shell so it never fired reliably, and `document.hasFocus()`
  is false on mobile in normal use, which latched the player permanently black.
  This was the "always black" bug.

Still open:
- `axinom.ts` hardcodes real-looking tenant defaults (`a85ddc8b-…`); missing env
  silently targets a specific tenant
- The `try/catch` around the inline-key block swallows key-format errors and
  falls back to `key_seed`, reproducing the same opaque failure
- `clearKeys` plumbing runs SecurePlayer → DrmPlayer; only the public Axinom demo
  key feeds it today, but ClearKey ships the content key to the browser in
  plaintext — guard it so it can never carry real content
- `SecurePlayer.tsx` has **6 pre-existing `rules-of-hooks` errors**: hooks are
  called after the `provider === "axinom"` early return. Switching lessons across
  providers on a mounted instance can throw "Rendered more hooks than during the
  previous render". This is the single best reason to restructure that component
  and should be folded into the rewire.

## Suggested rewire shape

Both providers already sit behind `resolveEmbedUrl` in `src/lib/video-provider.ts`.
Extend that rather than inventing a parallel system: one `DrmProvider` interface
returning `{ manifestUrl, licenseServers, token, capabilities }`, with Axinom and
VdoCipher as implementations, and one player that renders from that shape. Fix the
hook-order problem while restructuring.

---

# PART E — Secret preview page (REQUESTED, NOT STARTED)

## Requirement

Replace `/preview/drm` and `/preview/drm-capabilities` with one professional
preview that: is reachable only via a secret link, explains what is happening,
supports BOTH VdoCipher and Axinom, and reports whether capture is actually
blocked on the current device. Verify provider docs while building.

## The compositing rule — read before writing any markup

The root cause found this session: **never apply `opacity`, `filter`,
`transform`, `mix-blend-mode`, a CSS `transition` covering those, or
`border-radius` + `overflow:hidden` to a video/iframe surface or any ancestor
that clips it.**

Hardware-protected video is only protected while the browser hands it to the
display controller as an overlay plane; those frames never enter compositor
texture memory, which is what makes a recorder capture black. Any blending or
clipping requirement forces a fallback to an ordinary composited texture, which
IS capturable. The old player did all three at once, which is why VdoCipher
blocked capture standalone but not inside the app.

Draw blackout/loading states as **opaque sibling overlays** above the video, never
as styling on the video itself.

## Secret-link design (do not hand-roll)

Do NOT reuse the current scheme: `/api/teacher/drm-preview` returns a URL with a
live 2h DRM token in the query string, and the page itself is unauthenticated.
Tokens in URLs leak via history, referrers and proxy logs, and it is neither
scoped nor revocable.

Suggested instead:
- Server mints a random 32-byte `previewId` stored in a table with
  `assetId`, `provider`, `createdBy`, `expiresAt`, `revokedAt`, `maxViews`,
  `viewCount`.
- The link is `/preview/<previewId>` and carries no token or asset id.
- The page calls a server route that validates the id (exists, not expired, not
  revoked, under maxViews), increments the counter, and only then mints the
  short-lived DRM token server-side and returns it to that request.
- Teachers can list and revoke their own preview links.
- Rate-limit by IP on the lookup route so ids cannot be brute-forced.

Ownership gap to close while doing this: `/api/teacher/drm-preview` validates the
assetId charset but never checks that the requesting teacher owns the asset, so
any teacher can preview any teacher's content.

## Provider docs to verify (do not trust memory)

- VdoCipher: confirmed published limit is 70–80% on Windows desktop, with Chrome
  and Firefox explicitly "prone to screen capture"; Safari+FairPlay on macOS is
  their strong path. https://www.vdocipher.com/blog/screen-capture-block-video/
- Axinom: confirm the Widevine policy field name (`device_security_level`) against
  the live tenant — PlayReady's `min_device_security_level` is confirmed by the
  reference token in `src/lib/axinom.ts`, the Widevine half is NOT.
- Edge exposes hardware PlayReady under BOTH
  `com.microsoft.playready.recommendation.3000` and
  `com.microsoft.playready.recommendation` + robustness "3000". Probe both; the
  existing capability page already does.

## Capture reporting

The page can honestly report *capability* (which key system and robustness the
device grants, via `requestMediaKeySystemAccess`) but NOT *outcome* — no web API
reveals whether a recorder is running. Keep the A/B test: an encrypted clip plus
an unencrypted control, so the tester can prove their recorder works. Do not
label anything "protected" without an actual hardware probe result behind it.

---

# PART F — Low-visibility forensic watermark (REQUESTED, NOT STARTED)

## Correct the premise first

"Invisible while watching but visible if recorded" is not achievable with any
DOM/CSS overlay. A screen recording captures the pixels the screen shows, so an
overlay invisible to the student is equally invisible in their capture.

Genuinely invisible forensic marks (NexGuard, Irdeto, Verimatrix) are embedded
into the video bitstream per session at packaging time (A/B variant encoding),
server-side. That is a separate product and cost tier, not an overlay change.

## Achievable design (overlay-based, much less intrusive than today)

Current watermark is high-contrast, static-ish and draws the eye. Replace with:

1. **Very low opacity, tiled, diagonal.** ~4-6% opacity, repeated across the
   whole frame at ~30deg. Barely registers while watching; recoverable by
   boosting contrast/levels on a leaked file. Tiling is what survives cropping —
   a single corner mark is trivially cut off.
2. **Periodic full-opacity flash.** Every 30-60s, raise one tile to ~35% opacity
   for 2-3 frames (~100ms). Nearly unnoticeable in motion, but ANY recording of
   reasonable length contains several legible frames. This is the highest-value
   part and the cheapest to add.
3. **Opaque session code, not PII.** Today it renders the student's phone number.
   Render a short code (e.g. 8 chars) that maps server-side to
   (studentId, sessionToken, timestamp). Less eye-catching, avoids broadcasting a
   phone number to anyone in the room, and is still fully attributable.
   Store the mapping on VideoWatchSession.
4. **Survive re-encode.** Keep glyphs large and the stroke thick; fine 1px text
   dissolves under compression. Prefer a mid-grey that survives both light and
   dark scenes over pure white/black.

## Where

`SecurePlayer.tsx` and `DrmPlayer.tsx` both render `watermark`. The value is
built in `src/app/api/videos/[id]/watch/route.ts` as
`session.phone || session.name` — change it there to the opaque code.

## Compositing constraint (see Part E)

The watermark is a sibling overlay ABOVE the video and must stay that way. Do not
apply opacity/filter to the video element to make the mark stand out, and do not
wrap the video in a rounded/clipping container — either kills the hardware
overlay path and with it the black-frame protection.
