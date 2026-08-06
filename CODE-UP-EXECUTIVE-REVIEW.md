# Code-UP — Executive Board Review

**Review date:** 2026-08-02
**Method:** The Board reviewed the architecture document (`ARCHITECTURE.md`) and then **verified the highest-risk claims directly against the source code** in this repository — payment webhook, payment confirm, payment create, balance subscribe, access-code redemption, watch sessions, secure URL resolution, and the auth layer.

**Evidence labels used throughout:**

- ✅ **Verified in code** — read and confirmed in this repository
- 🔶 **Likely inference** — strongly suggested by verified code, not directly confirmed
- ❓ **Hypothesis — needs validation** — cannot be confirmed from what was provided

---

# Overall Score

# **54 / 100**

The score is deliberately split in character: the **educational and AI-operations architecture is genuinely excellent** (85+ territory — watch-quota atomicity, device locks, budget tiers, audit trails), but the **money layer is broken in ways a moderately skilled student can exploit with a single HTTP request**. A platform whose wallet can be forged cannot ship. The payment findings below are not theoretical — they are verified in the routes as written today.

---

# Executive Summary

### Top strengths (verified)

1. **Access-code redemption is race-safe.** Atomic `updateMany({ studentId: null, isActive: true })` claim inside a transaction, exponential IP+user rate limiting (`AccessCodeGuard`), and full attempt logging. This is textbook-correct. ✅
2. **Watch-quota enforcement is race-safe.** Count + slot consumption inside one transaction, `Serializable` on Postgres, write-conflict (`P2034`) retry handling, plus device binding, scheduled-publish locks, and a properly gated `secure-url` that requires a valid, owned, unexpired watch token. ✅
3. **Session hygiene is strong.** JWT re-validated against the DB on every request (suspended/deleted users die immediately), break-glass superadmin clearly separated, phone-verification challenge is a short-lived (3-min) signed token with hashed codes. ✅
4. **The AI Operations layer (per architecture)** — pre-flight budget checks, 5-tier automatic cost reduction, Gemini key pool with zero key exposure, full audit trail — is more mature than most funded startups' AI cost governance. (Architecture-verified; AI internals not code-reviewed in this pass.) ❓ partially

### Top weaknesses (verified — all in the money layer)

1. **The payment webhook can be forged by anyone.** No signature, no shared-secret header check, and the "optional" server verification is skipped entirely if the payload simply omits `transactionId`. One `curl` credits any wallet any amount.
2. **The credited amount comes from the attacker's payload**, never from a verified server response.
3. **The confirm endpoint credits whoever asks, not whoever paid** — no check that the transaction's `client` matches the logged-in user. One real payment can fund unlimited accounts.
4. **Students set their own price.** Both `subscribe-balance` and `sha7nawy/create` accept `amount` from the request body with no server-side price lookup.
5. **Wallet can go negative** via a check-then-act race in `subscribe-balance`.

### Risk map

| Category | Verdict |
|---|---|
| Business risks | **Severe** — wallet integrity is the foundation of the revenue model and it is currently unfounded |
| Technical risks | SQLite + in-memory AI analytics + payment ledger without unique constraints |
| Financial risks | Direct theft vector (forge credit → spend on subscriptions), self-pricing, double-crediting |
| UX risks | Payment flow lacks verified pending/receipt states; emoji-labeled payment tabs undercut "premium" |
| Security risks | **Critical** in payments; good elsewhere (sessions, codes, video) |
| Operational risks | No refund flow; full payment payloads logged to console; analytics lost on restart |

---

# Revenue Leak Analysis

| # | Leak | Evidence | Probability | Impact | Fix priority |
|---|---|---|---|---|---|
| 1 | **Webhook forgery** — `POST /api/payments/sha7nawy/webhook` with `{status:"completed", client:"<ownUserId>", amount: 99999}` credits the attacker's balance. Verification (`getSha7nawyPaymentInfo`) only runs `if (transactionId && process.env.SHA7NAWY_SECRET_KEY)` — omit `transactionId` and it is skipped. No HMAC/signature/IP allow-list. | ✅ `webhook/route.ts:33-42` | **Certain** (trivial to execute) | Existential — unlimited free balance | **P0 — today** |
| 2 | **Amount is payload-controlled.** Even when server verification succeeds, `amount` is parsed from `payload.amount` (line 44), never from `verifyRes.data.amount`. Attacker pays 5 EGP, replays/φορjes the webhook with amount 5000. | ✅ `webhook/route.ts:44` | **Certain** | Direct theft | **P0 — today** |
| 3 | **Confirm-endpoint credit redirection.** `POST /confirm` with any `ref_code` credits **`session.id`** — there is no check that `txData.client === session.id`. Idempotency is scoped per-user (`userId + note contains reference`), so the *same* real payment can credit the buyer via webhook **and** any number of other accounts via confirm. | ✅ `confirm/route.ts:20-63` | **Certain** | One payment → many funded wallets | **P0 — today** |
| 4 | **Self-pricing on balance purchases.** `subscribe-balance` reads `amount` from the request body; no plan/price lookup, no server-side enrollment record — just debit + ledger note. Student sends `amount: 1` for any subscription. | ✅ `subscribe-balance/route.ts:12-15` | **Certain** | Revenue set by the buyer | **P0 — today** |
| 5 | **Self-pricing on course purchases.** `sha7nawy/create` accepts `amount` from the client even when `courseId` is supplied; the course price is never read from the DB in this route. `courseTitle` only decorates the `details` string. | ✅ `create/route.ts:13-27,46-48` | **Certain** (if this route powers course checkout — 🔶 it appears to) | Courses sold at attacker-set prices | **P0** |
| 6 | **Negative-balance race.** Balance sufficiency is checked *outside* the transaction; the `decrement` inside the transaction never re-checks. Two concurrent requests both pass the check → balance goes negative. | ✅ `subscribe-balance/route.ts:28-41` | Medium | Free credit + accounting corruption | **P1** |
| 7 | **Weak idempotency key.** Duplicate-credit detection is `balanceTransaction.findFirst({ note: { contains: reference } })` — a substring match on a human-readable note, with **no unique constraint** on any reference column. Concurrent webhooks both pass `findFirst` before either commits → double credit. If `reference` is absent the fallback `contains: "sha7nawy"` matches *every* prior wallet top-up, silently blocking legitimate recharges. | ✅ `webhook/route.ts:62-74`, `confirm/route.ts:38-46` | High under load / retries | Double-credit or blocked legitimate payments | **P1** |
| 8 | **2% fee may not cover cost.** The 2% "tax & processing" is a flat markup; whether it covers Sha7nawy's actual per-carrier fees is unverified. If wallet fees exceed 2%, every top-up is sold at a loss. | ❓ Needs Sha7nawy fee schedule | Medium | Slow bleed at scale | **P2** |
| 9 | **No refund / chargeback flow anywhere** in schema or routes reviewed. Disputes will be handled manually (or on WhatsApp) — expensive and legally exposed. | ✅ absence verified in reviewed routes/schema doc | Certain (over time) | Support cost, legal risk | **P1** |

---

# Fraud Analysis

Think like a 16-year-old with Postman and a Discord server:

- **Create fake accounts?** ❓ Signup has phone verification with a 3-minute signed challenge (verified in `auth.ts`) — but `isPhoneVerificationBypassed()` exists as an escape hatch; if that flag is on in production, fake accounts are unlimited. **Must verify env flags per environment.**
- **Farm rewards / exploit referrals?** Referral qualification fires on *paid code* redemption (`codes/route.ts:103`) — paid gate makes farming costly. **However** the teacher promo-code path lets a student overwrite their own `referredByTeacherId` at any time with no existing-attribution check (`codes/route.ts:266-269`) — teachers can poach attribution, or collude with students to redirect commission. ✅ verified.
- **Duplicate purchases?** Yes — see leaks #3 and #7. One payment, many credits. ✅
- **Share accounts?** Mitigated by device lock (verified in watch + secure-url routes) — genuinely good. Residual: device-reset policy abuse ❓ (how often can a student reset devices?).
- **Abuse coupons / access codes?** Hard — single-use, atomic claim, rate-limited, logged. ✅ The strongest anti-fraud surface on the platform.
- **Exploit race conditions?** Watch quota: no (atomic). Wallet: yes (leak #6). Code redemption: no (atomic). ✅ mixed
- **Exploit wallet balances?** Trivially — leaks #1–#4 make the wallet attacker-printable money, and the wallet buys subscriptions. The fraud chain is: **forge credit → subscribe → resell access**. ✅
- **Exploit AI?** Per architecture: pre-flight budget check, abuse detection in AlertCenter, per-student budget dimension. Sound design ❓ (AI internals not code-verified this pass). Residual concern: a compromised/stolen student JWT can burn AI budget until budget tiers kick in — per-student caps are the right control, confirm they're enabled by default.
- **Exploit payment callbacks?** This is the headline — see Revenue Leaks #1–#3. ✅

---

# Security Review (OWASP Top 10 / ASVS)

| # | Finding | OWASP mapping | Severity | Attack scenario | Business impact | Mitigation | Priority |
|---|---|---|---|---|---|---|---|
| S1 | Webhook without authentication | API7:2023 Server-Side Request Forgery-adjacent / ASVS V13.1 | **Critical** | Attacker POSTs a forged `transaction.updated` with own user ID and arbitrary amount | Unlimited fraudulent balance; direct cash-equivalent loss | **Mandatory** server-to-server verification for *every* event (not optional); verify signature/secret header; credit the *verified* amount; IP allow-list as defense-in-depth | P0 |
| S2 | Amount/client not cross-checked against verified transaction | API6:2023 Unrestricted Access to Sensitive Business Flows | **Critical** | Pay 5 EGP, claim 5,000 | Theft at scale | Credit `verifyRes.data.amount` only; reject if `verifyRes.data.client !== payload.client` | P0 |
| S3 | Confirm endpoint trusts caller identity | API1:2023 BOLA | **Critical** | User submits a leaked/guessed `ref_code` belonging to another payment; balance lands in the attacker's wallet | One payment funds many accounts | Require `txData.client === session.id`; enforce unique reference constraint DB-wide (not per-user) | P0 |
| S4 | Client-supplied price | API6:2023 / Business logic | **Critical** | `amount: 1` on any purchase | Revenue collapse | Server-side price catalog: derive amount from `planId`/`courseId` in DB; never from the body | P0 |
| S5 | Check-then-act balance race | Race condition (ASVS V11 business logic) | High | Concurrent debit requests → negative balance | Free credit, ledger corruption | Conditional atomic decrement: `updateMany({ id, balance: { gte: amount } }, { decrement })` and fail on `count === 0` | P1 |
| S6 | Idempotency via note substring | Business logic | High | Retry/concurrent webhook → double credit; missing reference → blocks legit top-ups | Theft or denial of legitimate payments | Dedicated `reference` column with `UNIQUE`; upsert on it | P1 |
| S7 | Full payment payload + PII logged | API8:2023 Security Misconfiguration / ASVS V7 | Medium | Log aggregation exposes wallet numbers, user IDs, amounts | Privacy breach, compliance exposure | Log reference + status only; redact payloads | P1 |
| S8 | `SECURE_COOKIES` must be manually set for `Secure` flag | A05 Misconfiguration | Medium | Deployed without the env flag → session cookie over HTTP | Account takeover | Default `secure: true` in production; fail fast if misconfigured | P2 |
| S9 | `.env` documentation ships placeholder secrets pattern; JWT strength unverified | A07 Auth failures | Medium (❓) | Weak/default `JWT_SECRET` → forge any token incl. break-glass `superadmin` | Total platform compromise | Enforce min entropy at boot; verify no real secrets committed | P1 |
| S10 | CSRF on cookie-authenticated POSTs | A01 / ASVS V4 | Low-Medium (🔶) | JSON APIs + `sameSite:lax` largely mitigate; not fully verified | State-changing cross-site calls | Keep JSON-only APIs; verify no GET mutations | P3 |
| S11 | SQLite under payment load | Resilience | Operational | Single-writer lock contention on webhooks + purchases | Failed payments, stuck balances | Move to Postgres before launch (code already branches on `isPg`) | P1 |

**Positive verifications (no action needed):** video watch-token ownership/expiry checks, scheduled-publish locks, `secure-url` gating, code-redemption atomicity + rate limiting, per-request session re-validation, AI key encryption at rest with `Omit<"secretKey">` at the type level, prompt-injection alerting (per architecture).

---

# Business Logic Review

Reviewed as decisions, not code:

1. **Can students set their own price?** Yes — verified, leaks #4/#5. The single most damaging business-logic decision in the platform.
2. **Can one payment enroll many students?** Yes — confirm-endpoint redirection (leak #3).
3. **Can balances become negative?** Yes — race (leak #6). Also: no ledger reconciliation job exists; `balanceTransaction` is an audit table, not a source of truth, and nothing verifies `sum(transactions) === user.balance`. ❓ Add a nightly reconciliation.
4. **Can access codes be redeemed twice?** No — atomically claimed. ✅
5. **Can plans overlap incorrectly?** Partially safe: renewal extends an expired enrollment correctly (verified in `codes/route.ts:155-181`). But `pricePaid: 0` on renewals and code redemptions **pollutes revenue analytics** — finance will under-report. 🔶
6. **Can teachers manipulate analytics?** Promo-code attribution is student-overwritable (verified) — commission attribution is gameable. Require attribution to be set once, or first-touch locked.
7. **Can students skip paid lessons?** Video flow is well-guarded (quota, devices, schedule). Free-video bypass (`isFree`) is teacher-controlled — flag: who can flip `isFree`, and is that audited? ❓
8. **Can two purchases execute simultaneously?** Watch slots: no. Wallet: yes. Codes: no. ✅ mixed — fix the wallet.
9. **Orange Cash hard-blocked in code** (verified in `create/route.ts:33-38`) with a reassuring message — good human touch, but it's a code change to re-enable; move to `PlatformConfig` so ops can toggle without a deploy.

---

# Financial Efficiency

| Area | Finding | Evidence |
|---|---|---|
| Watch GET re-checks | Watch-session GET re-runs 5+ access queries (plan, video, folder access) on every page refresh; fine at current scale, will need consolidation | ✅ `watch/route.ts` |
| N+1 in plan detection | `planEnrollment → plan.lessons.some.sources.some` deep filter runs twice per watch POST | ✅ same |
| AI cost governance | BudgetManager pre-flight + 5 degradation tiers + nightly optimizer is **exemplary** design; AI cost explosion is the usual EdTech killer and it is addressed head-on | Architecture; ❓ runtime verification pending |
| In-memory analytics | 10K request explorer / 5K audit ring buffers vanish on restart — cheap to run, expensive to lose; persistence is already on the roadmap | ✅ admitted in doc |
| Redundant payment metadata | `details` string rebuilt from client-supplied title; minor | ✅ |
| Storage | No lifecycle policy mentioned for watch sessions / attempt logs — will grow unbounded | 🔶 add retention job |

---

# Human Experience Review

Screens were not available for direct review; assessment is from verified copy/routes + architecture. ❓ for visual claims.

**What already feels human (verified):**

- Orange Cash maintenance message: *"تحت الصيانة والتطوير حالياً لتقديم خدمة أفضل... دون قلق"* — reassuring, offers alternatives. Exactly right for a panicking parent.
- Watch-quota exhaustion message includes the number (`لقد استنفدت جميع محاولات المشاهدة... (3 مشاهدة)`) — specific, not robotic.
- Scheduled-content lock returns the unlock time — answers "when?" before it's asked.
- Balance-insufficient error shows both numbers (have vs. need) and the next action.

**Where it breaks:**

1. **Payment has no trustworthy "pending" state.** The student pays via wallet, then nothing in the reviewed routes guarantees a clear "we received it / it's processing / here's your receipt" journey. Confirm exists but is also the exploit. After S1–S4 fixes, design: *pending → confirmed → receipt (with reference number)* as a first-class flow. Money moments are where Egyptian parents decide to trust or abandon a platform.
2. **No receipts.** After a wallet top-up or purchase there is no retrievable receipt/invoice in the reviewed surface. Parents *need* paper trail for trust.
3. **Double-submit on subscribe-balance**: no idempotency key client→server — a double tap on a slow connection debits twice. Users will panic; support will drown.
4. **Teacher promo-code flow silently overwrites attribution** with no confirmation — "أنت الآن مرتبط بأ/ فلان" should be an explicit, confirmable choice.
5. **Error states are decent; success states are uncelebrated.** Course activation ("تم تفعيل الكود") is a purchase-completed moment — it deserves a celebration beat, not a toast.

---

# "Looks AI Generated" Detector

Assessed from architecture description + verified UI strings; ❓ visual confirmation pending.

Flags:

- **Emoji-labeled payment tabs** (`📱 محفظة`, `💰 بالرصيد`, `💬 واتساب`, `🔑 كود`) — the single most "generated" pattern in the product. Emoji-as-icons in a *payment* interface reads amateur to parents and erodes the "premium" positioning. Replace with consistent custom line icons.
- **Generic KPI-card dashboards** (architecture describes "Cards: Requests Today · Tokens Today…") — fine for internal ops, keep them off any parent/student surface.
- **Robotic ledger notes** are fine for logs, but ensure user-facing transaction history is localized and human ("شحنت محفظتك من فودافون كاش" not "credit_sha7nawy_wallet").
- Uniform dark-card grids + identical spacing (per DESIGN language hints) — introduce visual rhythm on marketing surfaces: asymmetric hero, real teacher photography, Egyptian classroom imagery, not stock gradients.

---

# Humanization Suggestions

1. **Receipts with reference numbers**, WhatsApp-shareable, in Egyptian Arabic ("إيصال شحن رقم...") — parents forward these to each other; it's a trust *and* growth feature.
2. **Context-aware greetings** in student dashboard (time-of-day + streak-aware: "كمّل، فاضل فيديو واحد على الستريك بتاعك").
3. **Recovery-first microcopy on payment failure** — never "فشلت العملية" alone; always "الفلوس وصلت ولا لسه؟ لو اتخصمت، ابعتلنا الرقم المرجعي وهنحلها" with a one-tap WhatsApp link.
4. **Parent reassurance line on every purchase screen**: "فلوسك محفوظة — أي مشكلة في الدفع بنرجعها خلال ٢٤ ساعة."
5. **Teacher personality**: let teachers record a 15-second welcome voice note per course; show their real photo on code cards.
6. **Progress celebrations** on watch-quota completion and quiz mastery — confetti is cheap; retention is expensive.
7. **Empty states that teach**: a wallet with 0 balance should show *how* to charge it (with the exact wallet steps per carrier), not a blank box.
8. Replace emoji tab icons with a consistent icon set; keep the tab *labels* colloquial Egyptian.

---

# Missing Features (ranked by ROI)

1. **Server-side price catalog + signed order intent** (P0) — not a feature, but nothing else matters until this exists.
2. **Refund & dispute flow** (P1) — legal exposure and support cost; mandatory for wallet-based commerce in practice.
3. **Receipts / transaction history page for students & parents** (P1) — trust + support deflection.
4. **Idempotency keys on all client payment actions** (P1).
5. **Ledger reconciliation job** (P1) — nightly `sum(transactions) vs balance` alert.
6. **Persistent AI analytics to DB** (P2) — already on roadmap; the observability investment is wasted if it evaporates on restart.
7. **Parent portal with verified identity link** (P2) — weekly reports exist; a login makes parents sticky and justifies premium pricing.
8. **Teacher commission dashboard with first-touch attribution lock** (P2).
9. **Certificates** (P3, roadmap) — high perceived value for 3rd-secondary students, cheap to build.
10. **English language option** (P3, roadmap) — defer; Arabic-first is correct for this market.

---

# Prioritized Action Plan

## Critical — fix immediately (before any real payment is accepted)

1. **Webhook**: mandatory server-side verification of every event; credit only the verified amount; reject client mismatch; add signature/secret header; stop skipping verification when `transactionId` is absent.
2. **Confirm endpoint**: require `txData.client === session.id`; global unique constraint on transaction reference.
3. **Server-side pricing**: never accept `amount` from the client for purchases; resolve price from DB by `courseId`/`planId`.
4. **Atomic balance debit**: conditional `updateMany` with `balance >= amount` guard; idempotency key per client request.

## High (this week)

5. `reference` column with UNIQUE constraint on `balanceTransaction`; idempotency by upsert, not note-substring.
6. Redact payment payloads from logs; log reference + status only.
7. Refund flow + receipts.
8. SQLite → Postgres migration plan for production (code already branches on `isPg`).
9. Verify `isPhoneVerificationBypassed()` and weak-secret guards cannot be on in production.

## Medium (this month)

10. First-touch lock on teacher attribution; promo-code overwrite requires explicit user confirmation.
11. Move Orange Cash toggle to `PlatformConfig`.
12. Reconciliation job + balance alert.
13. Persist AI ring buffers to DB; retention policy for watch sessions and attempt logs.
14. Replace emoji payment icons; payment pending/receipt UX.

## Low (quarter)

15. Default `secure: true` cookies in production builds.
16. Parent portal; certificates; English toggle.
17. Visual-rhythm pass on marketing surfaces.

## Future ideas

- Wallet top-up bonus tiers (charge 200, get 210) — increases prepaid float and locks in parents *after* the wallet is trustworthy.
- Teacher-scoped analytics export (CSV) for teacher retention.
- Offline-first quiz mode for low-connectivity areas.

---

# Information still needed (per review rules — listed, not guessed)

1. `src/lib/sha7nawy.ts` — exact semantics of `confirmSha7nawyPayment().status` (does `status: true` mean "API OK" or "paid"?). This determines whether S3's `|| result.status === true` credits *pending* transactions — if yes, severity worsens.
2. Whether `sha7nawy/create` is the production course-checkout path or wallet-top-up only.
3. Sha7nawy per-carrier fee schedule vs. the flat 2%.
4. Production environment: DB engine, `SECURE_COOKIES`, `SHA7NAWY_SECRET_KEY`, phone-bypass flag, `JWT_SECRET` entropy.
5. AI engine internals (`src/ai/`) — budget enforcement was not code-verified in this pass; architecture claims are strong but unconfirmed.
6. UI screenshots for a true visual/UX audit.

---

*Prepared by the Executive Board. Every Critical finding above cites a verified file and line. Nothing in the Critical tier is hypothetical.*
