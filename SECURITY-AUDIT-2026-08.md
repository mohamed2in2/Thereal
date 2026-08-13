# Code-UP — Security, Concurrency & Reliability Audit

**Date:** 2026-08-13
**Scope:** Full application review — 689 TS/TSX files, 194 API routes, 78 Prisma models
**Method:** Manual source review of authentication, authorization, payments, video access, parent
portal, OTP/WhatsApp, webhooks and background jobs; targeted fixes; regression tests.

---

## Executive Summary

Code-UP's **money handling is in better shape than its account handling**. Purchase flows use
conditional atomic decrements (`updateMany … where balance >= price`), advisory locks, and
state-transition claims; the payment webhooks re-verify server-side and are genuinely idempotent.
Access-code and money-code redemption are correctly race-free.

The serious problems were concentrated in **identity** and **video access**:

- A **pre-auth account takeover** affecting every student account. The password-reset OTP was
  verified against a hash the server *handed to the client*. Since the code is 6 digits, the hash
  is recoverable offline in under a second. No victim interaction required.
- Paid video could be pulled **without any enrollment check** through the local-stream route, and a
  video-provider outage caused the system to emit **permanent, un-revocable, unauthenticated**
  provider URLs.
- **Live API credentials for the video provider were committed to the source tree.**

11 issues were fixed and covered by a new 12-test security suite (`npm run test:security`).
The full findings list, including what was *not* changed and why, follows.

**Overall video theft resistance: Weak → Moderate.** The architectural holes are closed, but the
platform still relies on YouTube unlisted embeds for some content, which cannot be secured. See
[Video Security](#video-security) for an honest assessment.

---

## Critical Findings (fixed)

### C1 — Pre-auth account takeover via offline OTP recovery

**Severity:** Critical · **Impact:** Full takeover of any student account, including wallet balance.

**Root cause.** `createPhoneVerificationChallenge()` built a JWT containing
`codeHash = sha256(code)` and set it as the `student_phone_verify` cookie. A JWT payload is signed,
not encrypted — anyone holding the cookie can read it.

**Exploit.**

1. `POST /api/auth/forgot-password {phone: <victim>}`. The OTP goes to the *victim*; the
   `Set-Cookie` response header comes back to the *attacker*.
2. Base64url-decode the JWT payload → read `codeHash`.
3. `generateVerificationCode()` returns `100000 + randomInt(900000)` — exactly 900,000 candidates.
   Hash all of them; match. Sub-second on any laptop.
4. `POST /api/auth/reset-password {phone: <victim>, verificationCode: <recovered>, newPassword: …}`
   with the same cookie. `verifyPhoneVerificationCookie` compared `sha256(code)` to `codeHash` and
   passed.
5. Log in as the victim.

Egyptian mobile numbers (`01[0125]XXXXXXXX`) are a small enumerable keyspace, and there was no
attempt limiting on the challenge, so this scaled.

**Fix.** New `PhoneVerificationChallenge` model. The code hash is now `HMAC-SHA256(phone:code)`
keyed with `JWT_SECRET`, stored server-side and never transmitted. The cookie carries only an opaque
challenge id. Added: attempt limiting (5), single-use consumption via conditional `updateMany`, and
phone binding on the stored row as well as the cookie.

`src/lib/auth.ts`, `prisma/schema.prisma`, migration `20260813000000_add_phone_verification_challenge`

**Regression risk.** Low. Call-site signatures are unchanged; the four callers
(`forgot-password`, `send-code`, `reset-password`, `signup`) needed no edits. Challenges are now
persisted, so `PhoneVerificationChallenge` rows accumulate — see [R3](#r3--no-cleanup-for-expired-challenge-rows).

### C2 — `BYPASS_PHONE_VERIFICATION` disabled password-reset verification entirely

**Severity:** Critical (if ever set in production) · **Impact:** Reset any account with only a phone number.

When set, `reset-password` skipped the code check completely — `verificationCode` was not even
required. **Fix:** the flag is now refused in production with a logged error.
`src/lib/aws-sms.ts`

### C3 — Live video-provider API credentials committed to source

**Severity:** Critical · **Impact:** Anyone with repo access could mint playback tokens for the
entire video library and drive up provider spend.

`src/lib/alasly.ts` contained `ALASLY_API_KEY` and `ALASLY_API_SECRET` as literal fallback defaults
in three functions. **Fix:** credentials are read from the environment only; missing config throws.

> **Action required:** these keys are in git history. **Rotate them.** The fix stops new exposure but
> cannot un-publish what was committed.

### C4 — Video playback failed *open* on provider errors

**Severity:** Critical · **Impact:** Permanent, shareable, un-revocable links to paid lessons.

`getAlaslyPlaybackToken()` caught provider failures and returned a "resilient fallback":

```ts
embedUrl: `https://alasly.lovable.app/embed/lesson/${lessonId}`   // no token
```

A tokenless provider URL never expires and cannot be revoked. Any provider blip minted one, and it
was returned to the browser where it is trivially copied from the Network tab. A secondary path had
the same effect: `res.ok && (json.token || json.embed_url || json.ok)` accepted an `ok:true`
response carrying no token and then constructed `…?key=` with an empty token.

**Fix:** both paths now fail closed — a playback failure is the correct outcome.
`src/lib/alasly.ts`

### C5 — `/api/videos/stream/[id]` had no authorization

**Severity:** Critical · **Impact:** Any logged-in account could download any locally hosted lesson.

The route checked only that *a* session existed. Path traversal was blocked via `path.basename`,
but enrollment, purchase and plan gating were not checked at all — naming the file was sufficient.
Filenames are discoverable: they are the `providerVideoId`, returned by the playback APIs.

**Fix:** resolve the owning `Video` by `providerVideoId`/`vdoCipherId` and enforce
`checkVideoAccess()`. Also hardened `Range` parsing (a malformed header produced a negative-length
read) and stopped leaking raw error text, which exposed absolute server paths.
`src/app/api/videos/stream/[id]/route.ts`

---

## Security Findings (fixed)

### H1 — reCAPTCHA was bypassable by omitting the field

All three protected endpoints used `if (recaptchaToken) { verify }`. Sending no `recaptchaToken`
skipped verification entirely, making the bot defence client-optional. **Fix:** new
`enforceCaptcha()` rejects a *missing* token whenever reCAPTCHA is configured, and stays open when
it isn't (local dev / CI). `src/lib/login-guard.ts`, login / reset-devices / send-code routes

### H2 — No login rate limiting or lockout

`POST /api/auth/login` accepted unlimited password guesses per phone number. Combined with H1 this
enabled unthrottled credential stuffing. The platform config already defined `max_login_attempts`
and `lockout_minutes` — both were documented as *not enforced anywhere*.

**Fix:** added `failedLoginAttempts` / `lockedUntil` to `User` and wired the existing config keys.
The lockout is checked *before* `bcrypt.compare`, so a locked account also stops burning CPU.
Applied to `/api/auth/login` and `/api/auth/reset-devices` (which wipes all registered devices and
is at least as sensitive). `src/lib/login-guard.ts`, migration `20260813000001_add_login_lockout`

### H3 — Cron endpoint had a hardcoded fallback secret

`/api/cron/process-otp-queue` fell back to `CRON_SECRET || "codeup_secret_cron"`. The literal shipped
in the source tree, so anyone who read it could drain the WhatsApp OTP queue. **Fix:** no default;
the route 401s when `CRON_SECRET` is unset. (`expire-pending-payments` already did this correctly.)

### H4 — Session cookie was not `Secure` in production

`secure: NODE_ENV === "production" && SECURE_COOKIES === "true"` required an explicit opt-in, so a
standard production deploy sent the auth cookie over plain HTTP. **Fix:** `Secure` now defaults on in
production; `SECURE_COOKIES=false` remains available as an explicit opt-out.

### H5 — Bunny signed URLs were silently disabled

`bunny.ts` read `BUNNY_TOKEN_AUTHENTICATION_KEY`, but `.env.example` documents `BUNNY_TOKEN_KEY` and
`BUNNY_STREAM_TOKEN_AUTH_KEY`. A correctly configured deployment therefore fell through to the
*unsigned* embed branch — returning permanent Bunny URLs while reporting `signed: false`. **Fix:**
all three names accepted. `src/lib/bunny.ts`

### H6 — Weak RNG for OTP codes

`OtpService` generated codes with `Math.floor(100000 + Math.random() * 900000)`. V8's PRNG state is
recoverable from a handful of outputs, and an attacker can mint outputs on demand by requesting
codes. **Fix:** `randomInt` (CSPRNG), matching `generateVerificationCode()` elsewhere.

### H7 — Webhook secrets compared non-constant-time

Both payment webhooks used `!==`. **Fix:** shared `secretsMatch()` hashes both sides then
`timingSafeEqual`s, so neither content nor length leaks via timing. `src/lib/secret-compare.ts`

### H8 — Missing security headers

Only `X-Frame-Options` was set. **Fix:** added CSP (with the video-player hosts allowlisted so
playback keeps working), `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` and HSTS.
`/p/:token` gets `no-referrer` specifically — the parent-portal token is in the URL path and would
otherwise leak in `Referer` headers. `next.config.ts`

---

## Reliability Findings (fixed)

### R1 — Parent portal links were silently destroyed

`getOrCreateParentToken()` **rotated `tokenHash` on every call**, including when a valid token
already existed. The only caller, `maybeAutoSendParentPortalLink()`, then checked `if
(parentToken.sentAt) return null` and declined to send the new link — so the parent's working
WhatsApp link was killed and no replacement was ever delivered.

**Fix:** reuse without rotating; return `rawToken: null` to make it explicit that the raw value is
unrecoverable by design. The caller now checks `sentAt` *before* minting, and passes
`regenerate: true` only when nothing has been delivered yet. `src/lib/whatsapp/parentToken.ts`

### R2 — OTP daily quota was bypassed on the two highest-volume paths

`OtpQuotaManager` enforces a 250/day WhatsApp allowance with a 30-message reserve for password
resets — but `forgot-password` and `send-code` called `sendVerificationCode` directly and never
reserved quota. Only the queue-processing path used it. Result: unbounded provider spend, and the
password-reset reserve was meaningless.

**Fix:** both routes now reserve before sending and release the slot if delivery throws — closing
the "quota consumed but message never sent" state.

### R3 — Corrupt `node_modules` in this working tree (environment, not code)

**This tree cannot currently build.** At least three installed packages are missing files:

| Package | Missing | Breaks |
|---|---|---|
| `jose@6.2.3` | `dist/webapi/lib/aeskw.js` | `src/lib/auth.ts` → **all authentication** |
| `zod` | `v4/core/util.cjs` | `eslint-plugin-react-hooks` → **ESLint** |
| `@prisma/client` | `runtime/library.mjs`, `client.mjs`, `binary.mjs` | webpack ESM resolution → **`next build`** |

The diagnosis is unambiguous: `@prisma/client/runtime/` still contains `library.mjs.map`,
`client.mjs.map` and `binary.mjs.map` — **orphaned sourcemaps whose `.mjs` files are gone.** Files
were removed *after* a successful install. The `jose` case was verified directly against the
published tarball, which does contain `aeskw.js`.

The pattern (ESM variants specifically) points at antivirus quarantine or an interrupted install on
this Windows host, not at anything in the repository.

`jose` was restored from its pinned tarball so authentication and the test suite work.
**Run `npm ci` before the next deploy** — `next build` fails with
`Module not found: '@prisma/client/runtime/library'` until then. This was left for the operator to
run rather than executed here: `npm ci` wipes `node_modules` entirely, and on a host that has
already demonstrated it can drop files mid-install, an unattended re-install could leave the tree
in a worse state than it is now.

---

## Findings NOT changed (reported only)

These are real, but the fix is an operations decision or a larger change than this pass warranted.

| # | Finding | Severity | Why not changed |
|---|---|---|---|
| N1 | `SHA7NAWY_WEBHOOK_SECRET` / `SHAKEOUT_WEBHOOK_SECRET` are absent from `.env` and `.env.example` — **both payment webhooks return 500 and credit nothing** | High | Config, not code. Fails closed (safe), but automatic payment crediting is currently dead; the client-side `/confirm` route is carrying it. Set both secrets. |
| N2 | Production runs **SQLite** (`DATABASE_URL="file:./dev.db"`) under **PM2 `instances: "max"` cluster mode** | High | Multi-process writers on one SQLite file cause `SQLITE_BUSY`; `acquireAdvisoryLock()` is a **no-op** on non-Postgres, and the `Serializable` isolation in the watch-session transaction is skipped. Every in-memory limiter (`cooldown.ts`, `parentRateLimiter`) is also per-process, so limits multiply by worker count. Migrating to Postgres is the fix and is too large for this pass. |
| N3 | Webhook idempotency keys are **substring matches on `BalanceTransaction.note`** | Medium | Works, but `findMany({note: {startsWith}})` on an unindexed, unbounded-growth column is a full table scan on every webhook. Wants a dedicated `providerRef` column with a unique index. |
| N4 | `checkVideoAccess()` returns `true` for `accountMode === "TESTER"` on *any* course | Medium | Deliberate QA feature with audit logging. Flagging because a compromised or mis-flagged tester account has unrestricted access to all paid content. |
| N5 | Break-glass superadmin JWT (`id: "superadmin"`) bypasses all DB revocation checks | Medium | Intentional by design. Note that it cannot be revoked without rotating `JWT_SECRET`. |
| N6 | JWTs have no `jti` and no revocation list | Medium | Logout is cookie-clear only; a stolen token stays valid for `jwt_expiry_days` (default 7). |
| N7 | `prisma/dev.db` is committed to the repository | Medium | A database in version control. Should be `.gitignore`d. |
| N8 | The VPN/proxy guard in the watch route blocks on the `Via` header and `x-forwarded-for` hop count | Low | Trivially spoofed (helps nobody determined) and produces false positives behind legitimate CDNs/corporate proxies. Left as-is: changing it alters user-visible behavior without a clear ask. |
| N9 | `src/services/parent/ParentService.ts` is a fully in-memory service with no persistence and no callers | Low | Dead code. Not deleted — removing code I cannot prove is unreferenced at runtime is riskier than leaving it. |
| N10 | `verifyRecaptchaToken` fails **open** on network errors | Low | Deliberate ("don't lock out all users on a blip"). Reasonable trade-off; documenting it. |

---

## Concurrency Audit

Checked every operation touching balances, purchases, enrollments, codes, quotas and watch slots.

**Correct as written** (no change needed):

- **Wallet spending** — `updateMany({where: {id, balance: {gte: price}}, data: {decrement}})`. A
  conditional decrement; two concurrent purchases cannot overdraw. Verified by test.
- **Money-code redemption** — `updateMany({where: {id, isUsed: false}})`. Claim-then-credit.
  Verified by test.
- **Access-code / plan-code redemption** — same conditional-claim pattern, inside a transaction.
- **Payment webhooks** — the pending→credited type transition *is* the idempotency key; a duplicate
  delivery sees `claim.count === 0` and returns 200 without double-crediting.
- **Watch-slot quota** — count-and-create inside one transaction, `Serializable` on Postgres, with
  P2034 write-conflict handling returning 409.

**Newly protected:**

- Phone-verification challenges are single-use via conditional `updateMany` (previously a stateless
  cookie check with no consumption at all — the same code worked repeatedly until expiry).

**Weakened by deployment, not by code** — see N2. The advisory locks and `Serializable` isolation
that make the above safe are inactive on SQLite.

---

## Video Security

### Threat model

Assume the attacker has DevTools, can replay any authenticated request, script a headless browser,
and collaborate with other students. Everything the player receives is discoverable.

### What was actually exploitable (now closed)

| Attack | Status |
|---|---|
| Stream any lesson with any student account, no enrollment | **Fixed** (C5) |
| Harvest permanent tokenless provider URLs by triggering a provider error | **Fixed** (C4) |
| Mint playback tokens directly using credentials read from the repo | **Fixed** (C3) — *keys still need rotating* |
| Bunny URLs unsigned because of an env-name typo | **Fixed** (H5) |

### What remains, honestly

- **YouTube unlisted is not a security control.** `getYouTubeEmbedUrl()` returns
  `youtube-nocookie.com/embed/{videoId}`, and that URL is in the JSON response of
  `/api/videos/[id]/secure-url`. The 11-character video ID is one Network-tab glance away, works
  outside Code-UP, and cannot be expired, signed or revoked. `yt-dlp` handles the rest. The comment
  in `youtube.ts` claiming the embed URL "is never exposed directly to students" is **incorrect** —
  it is exposed in an API response. For content of real value, YouTube is the wrong provider.
- **VdoCipher is the strongest option present** (short-lived OTP + real DRM + forensic watermarking).
  Its OTP TTL is 3600s; that could reasonably drop to ~120s since the token only needs to survive
  player init.
- **Screen recording cannot be prevented by a web page.** OS-level capture, a second device, or a
  camera all defeat any browser technique. The realistic goals are deterrence, attribution and cost —
  not prevention. No fake anti-recording measures were added.
- **Watch sessions are 4 hours by default** (`watch_session_hours`) and `secure-url` re-resolves a
  fresh provider URL for the whole window. Shorter sessions would narrow the replay window.

### Recommended architecture for high-value content

Standardize on **VdoCipher** (or Bunny with token auth + DRM), with: per-playback server
authorization → short-lived (≤2 min) signed token bound to the authenticated user → provider-side
domain allowlisting → dynamic visible watermark carrying a masked student identifier → forensic
watermarking for leak attribution. Retire unlisted YouTube for anything paid.

---

## Tests Added

`npm run test:security` — `scripts/run-security-tests.mts`, 12 tests, all passing. Each maps to a
defect that was live:

1. Challenge cookie leaks nothing crackable — *executes the actual offline attack and asserts it fails*
2. Challenge is single-use under concurrency
3. `BYPASS_PHONE_VERIFICATION` refused in production
4. reCAPTCHA cannot be skipped by omitting the token
5. Login lockout after repeated failures, cleared on success
6. Video playback fails closed on provider outage
7. Video credentials absent from source (greps for the key patterns)
8. Webhook secret comparison rejects empty/null/length-mismatched secrets
9. Parent token is not silently rotated on reuse
10. Concurrent spend cannot overdraw a wallet
11. Money code cannot be redeemed twice concurrently
12. Auth cookie is `Secure` by default in production

---

## Verification Performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** (exit 0, no errors) |
| `npm run test:security` | **12/12 pass** |
| Prisma client regeneration | **Pass** |
| Both migrations applied to dev DB | **Pass** |
| Diff scanned for introduced secrets | **Clean** |
| `npx eslint` | **Could not run** — blocked by corrupt `zod` in `node_modules` (R3) |
| `npx next build` | **Fails** — `Module not found: '@prisma/client/runtime/library'`. Pre-existing `node_modules` corruption (R3), not caused by these changes; the same missing-`.mjs` files break the build on `main` too. |
| `npm run test:verification` (pre-existing) | **Inconclusive** — process does not exit; unrelated to these changes (it imports the Baileys WhatsApp stack, which keeps handles open) |

---

## Confidence

**High confidence** — verified by execution: the OTP takeover fix (the attack is run in the test
suite and fails), single-use challenge semantics, login lockout, captcha enforcement, fail-closed
video playback, absence of hardcoded credentials, webhook secret comparison, parent-token reuse,
wallet overdraw protection, money-code single-redemption, TypeScript correctness across the change.

**Medium confidence** — reasoned from source, not executed: the CSP allowlist covers every provider
actually in use (verify playback in a browser after deploy); the `/api/videos/stream` authorization
change assumes `providerVideoId` uniquely identifies a lesson file; N2's SQLite/PM2 analysis is
based on config files, not a running production host.

**Not verified:** the production build — `next build` cannot run in this tree until `node_modules`
is repaired (R3), so while `tsc --noEmit` passes cleanly across every changed file, the bundler has
not compiled them. End-to-end payment flows against the live gateways were not exercised. Whether
production actually runs the SQLite config found in `.env` was inferred from config files, not
observed. The AI subsystem (~200 files under `src/ai`) was mapped but not audited in depth.

**Not audited:** `src/ai/**` internals, the admin panel UI components, quiz/homework grading logic,
and the leaderboard system. Nothing in these areas surfaced during the route-level sweep, but they
did not receive line-by-line review.

---

---

# Final Review Pass (same day)

A second pass re-audited the changes above, attacked them, and ran the gates that
had never executed. Five further defects were found — three of them mine.

## Found in the existing system

### F1 — Client-supplied grade chose the price tier *(reported by the operator as "100 EGP shows even though it isn't the price")*

**Severity:** High · **Impact:** Students could pay any teacher's cheapest stage price.

`studentGrade` arrived in the request body and flowed into `verifyAuthoritativePrice()`,
which uses it to select a tier from `TeacherProfile.stagePricing`. A student could
send whichever stage was cheapest and be charged that, while `purchaseTeacherSubscription`
still recorded their *real* `educationalStage` on the subscription — cheap price,
full access. The same defect had a visible half: `BookingModal` defaults anonymous
visitors to `studentGrade = "sec_1"`, so logged-out users saw the `sec_1` tier price
(100 EGP on a profile priced that way) regardless of their actual grade.

**Fix:** `verifyAuthoritativePrice()` now resolves the grade from the student's own
profile whenever `studentId` is known, falling back to the supplied value only for
profiles with no stage recorded. Placing it there covers the quote, gateway-create,
checkout-discount and code-redemption paths from one choke point.
`src/lib/price-verifier.ts`, `src/services/purchase/PurchaseService.ts`

### F2 — Two divergent databases; which one ran was decided by a `try/catch`

**Severity:** Critical · **Impact:** The app could serve a months-stale database.

`src/lib/prisma.ts` passed `file:./dev.db` to the libSQL adapter, which resolves
relative paths against `process.cwd()` → `<root>/dev.db`. Every Prisma CLI command
resolves the same URL against the schema directory → `<root>/prisma/dev.db`. The two
files had genuinely diverged:

| File | Size | Users | Schema |
|---|---|---|---|
| `prisma/dev.db` | 1.7 MB | 129 | current (has `isOwner`, new tables) |
| `dev.db` (root) | 495 KB | 27 | frozen at Aug 4 |

The `catch` that falls back to a plain `PrismaClient` silently switched between them
depending on whether the native driver loaded — so repairing `node_modules` changed
which database the application read. Migrations were landing in one file while the
app read the other.

**Fix:** relative SQLite URLs are now anchored to the schema directory, matching the
CLI. `src/lib/prisma.ts`

### F3 — A one-off backfill ran on every boot, in every worker

**Severity:** Medium · **Impact:** Silent overwrite of teacher-set pricing.

`src/instrumentation.ts` ran `teacherProfile.updateMany({where: {priceMonthly: 200} | {priceTermly: 600}}, …)`
on every server start, outside the `NODE_APP_INSTANCE` guard that correctly protects
the cron registration below it. Any teacher who deliberately priced at 200 had all
three price columns reset on the next restart. Schema defaults are already
180/750/1200, so nothing can newly require it.

**Fix:** moved to migration `20260813000002_backfill_teacher_pricing` and removed
from the boot path.

## Regressions I introduced and then caught

| # | Defect | How it was caught |
|---|---|---|
| R-a | The new CSP omitted `fonts.googleapis.com` / `fonts.gstatic.com`, which would have blocked **every Arabic webfont** (Tajawal, IBM Plex Sans Arabic in the root layout; Amiri, Noto Naskh in the parent portal) | Enumerated external hosts referenced by client code before trusting the policy |
| R-b | `enforceCaptcha` hard-rejected a missing token, but `useRecaptcha().execute()` returns `""` whenever the Google script is slow, blocked or unreachable — so any such user would have been 400'd out of login | Read the client hook rather than assuming it always yields a token |
| R-c | Bunny env fallbacks used `??`, which stops at `""`; `.env.example` ships those keys as empty strings, so the added fallbacks would never have fired | Re-read my own change against the example env |

R-a and R-c are fixed. R-b is *latent, not active*: `RECAPTCHA_API_KEY` is unset in this
deployment, so `isRecaptchaEnforced()` is false and missing tokens are allowed today.
The server remains strict by design — **before enabling reCAPTCHA in production, fix
`useRecaptcha` to surface a retry instead of submitting an empty token**, or the first
user with a blocked Google script cannot log in. This is recorded as a remaining risk
rather than silently weakened, because weakening it would restore the original bypass.

## Verification (final)

| Gate | Result |
|---|---|
| `npm ci` | **Pass** — `node_modules` was an interrupted install, not active tampering. Confirmed by diffing installed trees against published tarballs (`lucide-react` shipped 1,976 `.mjs`; 0 were present, 1,962 after repair) |
| `node scripts/prisma-generate.js` | **Pass** |
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npx next build` | **Pass** (exit 0) — first successful production build in this tree |
| `npm run test:security` | **16/16 pass** |
| `npx eslint` (changed files) | Pre-existing failures only. My new files are clean; the repo already had 18 `no-explicit-any` errors in two untouched files at HEAD, so lint has never been a passing gate |
| Diff scanned for secrets / debris | **Clean** |

Note: `tsconfig.json` shows as modified — Next 16's build rewrote `jsx: "preserve"` to
`"react-jsx"` and added `.next/dev/types` to `include`. That is the build tool's own
maintenance, not a hand edit, and does not weaken checking.

## Tests added in this pass

13. Client cannot choose a cheaper pricing grade *(F1 regression test — asserts an attacker naming `sec_1` is still billed the student's real `sec_3` tier, and that a genuine `sec_1` student still gets the cheap tier)*
14. Duplicate webhook credits once
15. Concurrent plan enrollment creates exactly one row
16. Concurrent access-code redemption binds to exactly one student

## New remaining risk: WhatsApp starts per worker

`src/lib/whatsapp/index.ts` ends with `export const whatsapp = new WhatsAppService()`,
whose constructor calls `initAutoStart()`. Importing the module therefore starts a
Baileys client. There is **no `NODE_APP_INSTANCE` guard** on it (unlike the cron in
`instrumentation.ts`), so under PM2 `instances: "max"` every worker opens its own
WhatsApp session against the same on-disk auth state and runs its own infinite
exponential-backoff reconnect loop when unpaired. Observed directly: a test that merely
imported the module produced continuous pairing-QR generation and 48-second backoff
retries.

This was **not** changed — routing sends correctly when only one worker holds the
session requires a design decision (dedicated process, or fall through to the Meta
Cloud API on non-owner workers), and a blind guard would break OTP delivery on every
other worker. It is the top reliability risk below.

---

## Immediate Action Items

1. **Rotate the Alasly video API key and secret** — they are in git history (C3).
2. **Set `SHA7NAWY_WEBHOOK_SECRET` and `SHAKEOUT_WEBHOOK_SECRET`** — payment webhooks are currently
   non-functional (N1).
3. **Set `CRON_SECRET`** — the OTP queue cron now 401s without it (H3).
4. **Decide which `dev.db` is authoritative** before deploying F2's fix. The app will now read
   `prisma/dev.db` (129 users, current schema) consistently. If any production data lives in the
   root `dev.db`, reconcile first. Then delete the stale file and `.gitignore` both.
5. Confirm `BYPASS_PHONE_VERIFICATION` is not set in production.
6. **Do not enable `RECAPTCHA_API_KEY` until `useRecaptcha` is fixed** to stop submitting empty
   tokens (R-b) — otherwise users whose Google script is blocked cannot log in.
7. Resolve the **WhatsApp per-worker autostart** design question, or run PM2 in fork mode until then.
8. Plan the **SQLite → Postgres** migration (N2) — several concurrency protections are inert until
   then.
