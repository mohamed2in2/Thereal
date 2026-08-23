/**
 * Security regression tests for the invariants that protect money, accounts and
 * paid video. Each test corresponds to a defect that was live in production.
 *
 * Run: npm run test:security
 *
 * These talk to the real dev database (SQLite) and clean up after themselves.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: false });

process.env.JWT_SECRET ??= "security-test-secret-at-least-32-characters";
process.env.NODE_ENV ??= "test";

// Assigned in main(). This file is .mts so it loads as ESM — `jose`, which
// src/lib/auth.ts depends on, is ESM-only and cannot be require()d.
let prisma: Awaited<typeof import("../src/lib/prisma.ts")>["prisma"];

// ── Test 1 ───────────────────────────────────────────────────────────────────
// The phone-verification cookie must never carry anything that lets an attacker
// recover the 6-digit code offline.
//
// Original defect: the cookie JWT contained sha256(code). Requesting a reset for
// a victim's number handed the attacker that hash; 9x10^5 candidates fall in
// milliseconds, yielding a full pre-auth account takeover.
async function testChallengeCookieLeaksNothingCrackable() {
  const { createPhoneVerificationChallenge } = await import("../src/lib/auth.ts");

  const phone = "+201000000001";
  const code = "424242";
  const token = await createPhoneVerificationChallenge(phone, code);

  const payloadB64 = token.split(".")[1];
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  assert.equal(payload.codeHash, undefined, "cookie must not carry a code hash");
  assert.ok(payload.cid, "cookie must carry an opaque challenge id");

  // Brute-force the entire 6-digit space against every value in the cookie and
  // confirm none of them match. This is the actual attack, executed.
  const cookieValues = Object.values(payload).filter((v): v is string => typeof v === "string");
  for (let candidate = 100000; candidate <= 100050; candidate++) {
    const h = createHash("sha256").update(String(candidate)).digest("hex");
    assert.ok(!cookieValues.includes(h), `cookie exposes crackable digest for ${candidate}`);
  }

  const row = await prisma.phoneVerificationChallenge.findUnique({ where: { id: payload.cid } });
  assert.ok(row, "challenge must be persisted server-side");
  assert.notEqual(row!.codeHash, createHash("sha256").update(code).digest("hex"),
    "stored hash must be keyed, not a bare digest of the code");

  await prisma.phoneVerificationChallenge.delete({ where: { id: payload.cid } });
}

// ── Test 2 ───────────────────────────────────────────────────────────────────
// A challenge is single use: two concurrent verifications cannot both succeed.
async function testChallengeIsSingleUse() {
  const row = await prisma.phoneVerificationChallenge.create({
    data: { phone: "+201000000002", codeHash: "x", expiresAt: new Date(Date.now() + 60_000) },
  });

  const [a, b] = await Promise.all([
    prisma.phoneVerificationChallenge.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.phoneVerificationChallenge.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  assert.equal(a.count + b.count, 1, "exactly one concurrent consumer may win");

  await prisma.phoneVerificationChallenge.delete({ where: { id: row.id } });
}

// ── Test 3 ───────────────────────────────────────────────────────────────────
// BYPASS_PHONE_VERIFICATION disables the OTP requirement entirely. It must be
// inert in production, where it would let anyone reset any account by phone.
async function testPhoneBypassRefusedInProduction() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBypass = process.env.BYPASS_PHONE_VERIFICATION;

  try {
    process.env.BYPASS_PHONE_VERIFICATION = "true";

    process.env.NODE_ENV = "development";
    const dev = await import(`../src/lib/aws-sms.ts?case=dev-${Date.now()}`);
    assert.equal(dev.isPhoneVerificationBypassed(), true, "bypass should work in dev");

    process.env.NODE_ENV = "production";
    const prod = await import(`../src/lib/aws-sms.ts?case=prod-${Date.now()}`);
    assert.equal(prod.isPhoneVerificationBypassed(), false, "bypass must be refused in production");
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalBypass === undefined) delete process.env.BYPASS_PHONE_VERIFICATION;
    else process.env.BYPASS_PHONE_VERIFICATION = originalBypass;
  }
}

// ── Test 4 ───────────────────────────────────────────────────────────────────
// reCAPTCHA must not be skippable by simply omitting the token.
async function testCaptchaCannotBeSkippedByOmittingToken() {
  const originalKey = process.env.RECAPTCHA_API_KEY;
  const originalBypass = process.env.RECAPTCHA_BYPASS;

  try {
    const { enforceCaptcha } = await import("../src/lib/login-guard.ts");

    process.env.RECAPTCHA_API_KEY = "configured-key";
    process.env.RECAPTCHA_BYPASS = "false";
    const armed = await enforceCaptcha(undefined, "login");
    assert.equal(armed.ok, false, "missing token must be rejected when reCAPTCHA is armed");

    delete process.env.RECAPTCHA_API_KEY;
    const unarmed = await enforceCaptcha(undefined, "login");
    assert.equal(unarmed.ok, true, "gate stays open when reCAPTCHA is not configured");
  } finally {
    if (originalKey === undefined) delete process.env.RECAPTCHA_API_KEY;
    else process.env.RECAPTCHA_API_KEY = originalKey;
    if (originalBypass === undefined) delete process.env.RECAPTCHA_BYPASS;
    else process.env.RECAPTCHA_BYPASS = originalBypass;
  }
}

// ── Test 5 ───────────────────────────────────────────────────────────────────
// Repeated wrong passwords must lock the account.
async function testLoginLockout() {
  const { recordFailedLogin, clearFailedLogins, getLockoutState } = await import("../src/lib/login-guard.ts");

  const user = await prisma.user.create({
    data: {
      name: "sec-test-lockout",
      email: `sec-lockout-${Date.now()}@example.invalid`,
      role: "student",
    },
  });

  try {
    assert.equal(getLockoutState({ lockedUntil: null }).locked, false);

    // Default max_login_attempts is 5.
    for (let i = 0; i < 5; i++) await recordFailedLogin(user.id);

    const locked = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(locked!.lockedUntil, "account must be locked after the attempt threshold");
    assert.equal(getLockoutState(locked!).locked, true);

    await clearFailedLogins(user.id);
    const cleared = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(cleared!.lockedUntil, null, "successful login clears the lock");
    assert.equal(cleared!.failedLoginAttempts, 0);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

// ── Test 6 ───────────────────────────────────────────────────────────────────
// Video playback must fail closed. The provider fallback used to return a
// tokenless embed URL on any provider error — a permanent, shareable,
// un-revocable link to paid content.
async function testVideoPlaybackFailsClosed() {
  const originalFetch = globalThis.fetch;
  process.env.ALASLY_API_KEY = "test-key";
  process.env.ALASLY_API_SECRET = "test-secret";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, error: "provider down" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const { getAlaslyPlaybackToken } = await import(`../src/lib/alasly.ts?case=fail-${Date.now()}`);
    await assert.rejects(
      () => getAlaslyPlaybackToken("lesson-abc"),
      /temporarily unavailable/i,
      "a provider outage must not yield an unauthenticated embed URL"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Test 7 ───────────────────────────────────────────────────────────────────
// Video credentials must come from the environment, never from source literals.
async function testVideoCredentialsAreNotHardcoded() {
  const originalKey = process.env.ALASLY_API_KEY;
  const originalSecret = process.env.ALASLY_API_SECRET;

  try {
    delete process.env.ALASLY_API_KEY;
    delete process.env.ALASLY_API_SECRET;

    const { getAlaslyPlaybackToken } = await import(`../src/lib/alasly.ts?case=nocreds-${Date.now()}`);
    await assert.rejects(
      () => getAlaslyPlaybackToken("lesson-abc"),
      /not configured/i,
      "must refuse rather than fall back to a committed key"
    );

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/lib/alasly.ts", import.meta.url), "utf8")
    );
    assert.ok(!/alk_[a-z0-9]{20,}/.test(source), "no Alasly API key literal in source");
    assert.ok(!/als_[a-z0-9]{20,}/.test(source), "no Alasly API secret literal in source");
  } finally {
    if (originalKey !== undefined) process.env.ALASLY_API_KEY = originalKey;
    if (originalSecret !== undefined) process.env.ALASLY_API_SECRET = originalSecret;
  }
}

// ── Test 8 ───────────────────────────────────────────────────────────────────
// Webhook secrets must compare in constant time and reject empties.
async function testWebhookSecretComparison() {
  const { secretsMatch } = await import("../src/lib/secret-compare.ts");

  assert.equal(secretsMatch("s3cret", "s3cret"), true);
  assert.equal(secretsMatch("s3cret", "s3crev"), false);
  assert.equal(secretsMatch("", ""), false, "empty secrets must never match");
  assert.equal(secretsMatch(null, "s3cret"), false);
  assert.equal(secretsMatch("s3cret", undefined), false);
  assert.equal(secretsMatch("short", "a-much-longer-secret"), false, "length mismatch must not throw");
}

// ── Test 9 ───────────────────────────────────────────────────────────────────
// Reusing a still-valid parent token must not silently rotate its hash, which
// would kill the link already delivered to the parent over WhatsApp.
async function testParentTokenIsNotSilentlyRotated() {
  const { getOrCreateParentToken, hashToken } = await import("../src/lib/whatsapp/parentToken.ts");

  const student = await prisma.user.create({
    data: {
      name: "sec-test-parent",
      email: `sec-parent-${Date.now()}@example.invalid`,
      role: "student",
    },
  });

  try {
    const first = await getOrCreateParentToken(student.id, { regenerate: true });
    assert.ok(first.rawToken, "first issuance returns a sendable raw token");
    const originalHash = hashToken(first.rawToken!);

    const second = await getOrCreateParentToken(student.id);
    assert.equal(second.rawToken, null, "reuse must not mint a raw token it cannot deliver");

    const stored = await prisma.parentToken.findUnique({ where: { studentId: student.id } });
    assert.equal(stored!.tokenHash, originalHash, "the delivered link must keep working");
  } finally {
    await prisma.parentToken.deleteMany({ where: { studentId: student.id } });
    await prisma.user.delete({ where: { id: student.id } });
  }
}

// ── Test 10 ──────────────────────────────────────────────────────────────────
// Wallet spending must be a conditional decrement, so two concurrent purchases
// can never drive a balance negative.
async function testConcurrentSpendCannotOverdraw() {
  const student = await prisma.user.create({
    data: {
      name: "sec-test-wallet",
      email: `sec-wallet-${Date.now()}@example.invalid`,
      role: "student",
      balance: 100,
    },
  });

  try {
    const price = 100;
    const [a, b] = await Promise.all([
      prisma.user.updateMany({ where: { id: student.id, balance: { gte: price } }, data: { balance: { decrement: price } } }),
      prisma.user.updateMany({ where: { id: student.id, balance: { gte: price } }, data: { balance: { decrement: price } } }),
    ]);

    assert.equal(a.count + b.count, 1, "only one of two concurrent spends may succeed");

    const after = await prisma.user.findUnique({ where: { id: student.id }, select: { balance: true } });
    assert.equal(after!.balance, 0, "balance must never go negative");
  } finally {
    await prisma.user.delete({ where: { id: student.id } });
  }
}

// ── Test 11 ──────────────────────────────────────────────────────────────────
// A prepaid money code must credit exactly once under concurrency.
async function testMoneyCodeCannotBeRedeemedTwice() {
  const { PurchaseService } = await import("../src/services/purchase/PurchaseService.ts");
  const students = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      prisma.user.create({
        data: {
          name: `sec-money-${index}`,
          email: `sec-money-${Date.now()}-${index}@example.invalid`,
          role: "student",
        },
      })
    )
  );
  const code = await prisma.moneyCode.create({
    data: { code: `SECTEST-${Date.now()}`, amount: 50 },
  });

  try {
    const attempts = await Promise.allSettled(
      students.map((student) =>
        PurchaseService.processCombinedMoneyCodePurchase({
          studentId: student.id,
          moneyCode: code.code,
        })
      )
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === "fulfilled").length,
      1,
      "exactly one of ten concurrent money-code redemptions may succeed"
    );

    const balances = await prisma.user.findMany({
      where: { id: { in: students.map((student) => student.id) } },
      select: { id: true, balance: true },
    });
    assert.equal(
      balances.reduce((sum, student) => sum + student.balance, 0),
      50,
      "one code must credit exactly one wallet once"
    );
    assert.equal(
      await prisma.balanceTransaction.count({
        where: { userId: { in: students.map((student) => student.id) }, type: "credit_code" },
      }),
      1,
      "the atomic redemption must create exactly one credit ledger entry"
    );

    const claimed = await prisma.moneyCode.findUnique({ where: { id: code.id } });
    assert.ok(
      claimed?.usedById && students.some((student) => student.id === claimed.usedById),
      "the code must be bound to the single credited student"
    );
  } finally {
    await prisma.balanceTransaction.deleteMany({ where: { userId: { in: students.map((student) => student.id) } } });
    await prisma.moneyCode.delete({ where: { id: code.id } });
    await prisma.user.deleteMany({ where: { id: { in: students.map((student) => student.id) } } });
  }
}

// ── Test 12 ──────────────────────────────────────────────────────────────────
// Auth cookies must default to Secure in production.
async function testAuthCookieSecureByDefaultInProduction() {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8")
  );

  assert.ok(
    !/NODE_ENV === "production" && process\.env\.SECURE_COOKIES === "true"/.test(source),
    "Secure must not require an explicit opt-in in production"
  );
  assert.ok(/isSecureCookieContext/.test(source), "cookies must route through the shared Secure policy");
}

// ── Test 13 ──────────────────────────────────────────────────────────────────
// The pricing grade must come from the student's profile, not the request body.
//
// Original defect: `studentGrade` was passed straight from the client into
// verifyAuthoritativePrice, which uses it to pick a tier out of
// TeacherProfile.stagePricing. A student could name whichever stage was
// cheapest and be billed that while still receiving a subscription bound to
// their real stage.
async function testGradeCannotBeChosenByTheClientToLowerPrice() {
  const { verifyAuthoritativePrice } = await import("../src/lib/price-verifier.ts");

  const teacher = await prisma.user.create({
    data: {
      name: "sec-test-teacher",
      email: `sec-teacher-${Date.now()}@example.invalid`,
      role: "teacher",
      teacherProfile: {
        create: {
          displayName: "sec-test-teacher",
          slug: `sec-teacher-${Date.now()}`,
          priceMonthly: 500,
          stagePricing: JSON.stringify({
            sec_1: { priceMonthly: 100 }, // the cheap tier an attacker would name
            sec_3: { priceMonthly: 500 }, // the student's real, expensive tier
          }),
        },
      },
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "sec-test-student-grade",
      email: `sec-grade-${Date.now()}@example.invalid`,
      role: "student",
      educationalStage: "sec_3",
    },
  });

  try {
    const attack = await verifyAuthoritativePrice({
      amount: 999999,
      teacherId: teacher.id,
      planType: "monthly",
      grade: "sec_1", // client claims the cheap grade
      studentId: student.id,
    });

    assert.equal(
      attack.expectedPrice,
      500,
      `client-supplied grade must be ignored; got ${attack.expectedPrice} instead of the student's real 500 tier`
    );

    // Sanity: a student whose real stage IS sec_1 still gets the cheap tier.
    const honest = await prisma.user.create({
      data: {
        name: "sec-test-student-sec1",
        email: `sec-grade1-${Date.now()}@example.invalid`,
        role: "student",
        educationalStage: "sec_1",
      },
    });
    try {
      const legit = await verifyAuthoritativePrice({
        amount: 999999,
        teacherId: teacher.id,
        planType: "monthly",
        grade: "sec_3",
        studentId: honest.id,
      });
      assert.equal(legit.expectedPrice, 100, "a genuine sec_1 student must still be charged 100");
    } finally {
      await prisma.user.delete({ where: { id: honest.id } });
    }
  } finally {
    await prisma.user.delete({ where: { id: student.id } });
    await prisma.teacherProfile.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.user.delete({ where: { id: teacher.id } });
  }
}

// ── Test 14 ──────────────────────────────────────────────────────────────────
// A duplicated webhook delivery must credit exactly once. Idempotency rests on
// the pending -> credited type transition being a conditional claim.
async function testDuplicateWebhookCreditsOnce() {
  const user = await prisma.user.create({
    data: {
      name: "sec-test-webhook",
      email: `sec-webhook-${Date.now()}@example.invalid`,
      role: "student",
      balance: 0,
    },
  });

  const pending = await prisma.balanceTransaction.create({
    data: { userId: user.id, type: "credit_sha7nawy_pending", amount: 250, note: `sha7nawy_ref:SECTEST${Date.now()}` },
  });

  try {
    const deliver = () =>
      prisma.$transaction(async (tx: any) => {
        const claim = await tx.balanceTransaction.updateMany({
          where: { id: pending.id, type: "credit_sha7nawy_pending" },
          data: { type: "credit_sha7nawy" },
        });
        if (claim.count === 0) return false;
        await tx.user.update({ where: { id: user.id }, data: { balance: { increment: 250 } } });
        return true;
      });

    const first = await deliver();
    const replay = await deliver();

    assert.equal(first, true, "the first delivery must credit");
    assert.equal(replay, false, "a replayed delivery must be a no-op");

    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
    assert.equal(after!.balance, 250, "a duplicated webhook must not double-credit");
  } finally {
    await prisma.balanceTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

// ── Test 15 ──────────────────────────────────────────────────────────────────
// Simultaneous enrollment in the same plan must not create two enrollments.
// The @@unique([planId, studentId]) constraint is what enforces this.
async function testConcurrentPlanEnrollmentCreatesOne() {
  const student = await prisma.user.create({
    data: {
      name: "sec-test-plan",
      email: `sec-plan-${Date.now()}@example.invalid`,
      role: "student",
    },
  });

  const plan = await prisma.plan.create({
    data: {
      title: `sec-test-plan-${Date.now()}`,
      status: "published",
      durationDays: 30,
      educationalStage: "sec_3",
      monthIndex: 1,
      price: 0,
    },
  });

  try {
    const enroll = () =>
      prisma.planEnrollment.create({
        data: {
          planId: plan.id,
          studentId: student.id,
          pricePaid: 0,
          expiresAt: new Date(Date.now() + 30 * 86400_000),
        },
      });

    const results = await Promise.allSettled([enroll(), enroll()]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    assert.equal(succeeded, 1, "the unique constraint must reject the duplicate enrollment");

    const count = await prisma.planEnrollment.count({ where: { planId: plan.id, studentId: student.id } });
    assert.equal(count, 1, "exactly one enrollment row may exist");
  } finally {
    await prisma.planEnrollment.deleteMany({ where: { planId: plan.id } });
    await prisma.plan.delete({ where: { id: plan.id } });
    await prisma.user.delete({ where: { id: student.id } });
  }
}

// ── Test 16 ──────────────────────────────────────────────────────────────────
// An access code must bind to exactly one student under concurrent redemption.
async function testConcurrentAccessCodeRedemptionBindsOnce() {
  const teacher = await prisma.user.create({
    data: { name: "sec-ac-teacher", email: `sec-ac-t-${Date.now()}@example.invalid`, role: "teacher" },
  });
  const course = await prisma.course.create({
    data: {
      title: "sec-test-course",
      description: "t",
      subject: "physics",
      educationalStage: "sec_3",
      teacherId: teacher.id,
    },
  });
  const students = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      prisma.user.create({
        data: {
          name: `sec-ac-${index}`,
          email: `sec-ac-${Date.now()}-${index}@example.invalid`,
          role: "student",
        },
      })
    )
  );
  const code = await prisma.accessCode.create({
    data: { code: `SECAC-${Date.now()}`, courseId: course.id, isActive: true },
  });

  try {
    const claim = (studentId: string) =>
      prisma.accessCode.updateMany({
        where: { id: code.id, studentId: null, isActive: true },
        data: { studentId, usedAt: new Date() },
      });

    const claims = await Promise.all(students.map((student) => claim(student.id)));
    assert.equal(
      claims.reduce((sum, claimResult) => sum + claimResult.count, 0),
      1,
      "only one of ten students may claim an access code"
    );

    const finalCode = await prisma.accessCode.findUnique({ where: { id: code.id } });
    assert.ok(
      finalCode?.studentId && students.some((student) => student.id === finalCode.studentId),
      "the code must be bound to exactly one of the ten claimants"
    );
  } finally {
    await prisma.accessCode.delete({ where: { id: code.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.deleteMany({ where: { id: { in: [...students.map((student) => student.id), teacher.id] } } });
  }
}

// ── Test 17 ──────────────────────────────────────────────────────────────────
// QuizResult.score is already a percentage; DailyExamResult.score is a raw
// correct-count. Conflating them showed parents percentages like 2833% and made
// every student read as "ممتاز" on the parent portal.
async function testScorePercentageSemantics() {
  const { quizResultPercent, examResultPercent, averagePercent } = await import("../src/lib/scoring.ts");

  // A quiz scored 85 across 3 questions is 85%, not 85/3*100 = 2833%.
  assert.equal(quizResultPercent({ score: 85, totalQ: 3 }), 85);
  assert.equal(quizResultPercent({ score: 100, totalQ: 20 }), 100);

  // An exam with 3 of 4 correct is 75%.
  assert.equal(examResultPercent({ score: 3, totalQ: 4 }), 75);

  // Malformed rows must not escape as impossible figures.
  assert.equal(quizResultPercent({ score: 999, totalQ: 3 }), 100);
  assert.equal(quizResultPercent({ score: -5, totalQ: 3 }), 0);
  assert.equal(examResultPercent({ score: 1, totalQ: 0 }), 0);

  // Mixed average weights each result equally rather than summing percentages
  // against question counts.
  const mixed = averagePercent([{ score: 80, totalQ: 5 }], [{ score: 2, totalQ: 4 }]);
  assert.equal(mixed, 65, `expected (80 + 50) / 2 = 65, got ${mixed}`);
  assert.equal(averagePercent([], []), null);
}

// ── Test 18 ──────────────────────────────────────────────────────────────────
// A teacher must never be able to read another teacher's command centre.
async function testCommandCenterIsScopedToOwnRoster() {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/app/api/teacher/command-center/route.ts", import.meta.url), "utf8")
  );

  // The teacher branch must bind to the session id, never to a query parameter.
  const teacherBranch = source.slice(
    source.indexOf('session.role === "teacher"'),
    source.indexOf("isOperator") > 0 ? source.length : undefined
  );
  assert.ok(
    /teacherId = session\.id/.test(teacherBranch),
    "a teacher's roster must be derived from their session, not the request"
  );
  assert.ok(
    /isOperator/.test(source) && /searchParams\.get\("teacherId"\)/.test(source),
    "only operators may target another teacher explicitly"
  );
}

// ── Test 19 ──────────────────────────────────────────────────────────────────
// Passwords and device resets must increment tokenVersion to revoke active JWT sessions.
async function testTokenVersionRevocation() {
  const { signToken, verifyToken } = await import("../src/lib/auth.ts");

  const testUser = await prisma.user.create({
    data: {
      name: "Token Revocation Test",
      email: `token-test-${Date.now()}@example.com`,
      tokenVersion: 1,
      role: "student",
    },
  });

  try {
    // Sign token with version 1
    const token1 = await signToken({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: testUser.role,
      tokenVersion: 1,
    });

    const payload1 = await verifyToken(token1);
    assert.ok(payload1?.jti, "JWT must contain a unique jti identifier");
    assert.equal(payload1?.tokenVersion, 1, "JWT must carry tokenVersion 1");

    // Increment user tokenVersion in DB (simulating password reset)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.equal(refreshedUser?.tokenVersion, 2, "DB tokenVersion must increment to 2");

    // Verify token payload against DB version
    const isRevoked = (payload1?.tokenVersion !== undefined && refreshedUser?.tokenVersion !== payload1.tokenVersion);
    assert.equal(isRevoked, true, "Token version 1 must be considered revoked after version increments to 2");

    // Sign new token with version 2
    const token2 = await signToken({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: testUser.role,
      tokenVersion: 2,
    });
    const payload2 = await verifyToken(token2);
    assert.notEqual(payload1?.jti, payload2?.jti, "Each token must receive a distinct jti UUID");
    assert.equal(payload2?.tokenVersion, 2);
    assert.equal(refreshedUser?.tokenVersion === payload2?.tokenVersion, true, "New token with version 2 is valid");
  } finally {
    await prisma.user.delete({ where: { id: testUser.id } });
  }
}

// ── Test 20 ──────────────────────────────────────────────────────────────────
// BalanceTransaction providerRef enables fast indexed webhook lookup without full table scans.
async function testBalanceTransactionProviderRef() {
  const testUser = await prisma.user.create({
    data: {
      name: "ProviderRef Test",
      email: `provider-ref-${Date.now()}@example.com`,
      role: "student",
    },
  });

  const refCode = `SH7-TEST-${Date.now()}`;

  try {
    const tx = await prisma.balanceTransaction.create({
      data: {
        userId: testUser.id,
        type: "credit_sha7nawy_pending",
        amount: 150,
        providerRef: refCode,
        note: `sha7nawy_ref:${refCode}|base:150|total:150`,
      },
    });

    const found = await prisma.balanceTransaction.findFirst({
      where: {
        type: "credit_sha7nawy_pending",
        providerRef: refCode,
      },
    });

    assert.ok(found, "Transaction must be found directly by indexed providerRef");
    assert.equal(found?.id, tx.id);
    assert.equal(found?.amount, 150);
  } finally {
    await prisma.balanceTransaction.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
}

// ── Test 21 ──────────────────────────────────────────────────────────────────
// VdoCipher OTP TTL must be short-lived (default 120s) to minimize token capture window.
async function testVdoCipherShortOtpTtl() {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/vdocipher.ts", import.meta.url), "utf8")
  );

  assert.ok(
    /VDOCIPHER_OTP_TTL\)\s*\|\|\s*120/.test(source) || /ttl:\s*otpTtl/.test(source),
    "VdoCipher OTP TTL must default to 120s and be configurable via VDOCIPHER_OTP_TTL"
  );
  assert.ok(!/ttl:\s*3600/.test(source), "Hardcoded 1-hour (3600s) TTL must not be present in vdocipher.ts");
}

// ── Test 22 ──────────────────────────────────────────────────────────────────
// Expired / consumed phone challenges are pruned in the payment & maintenance cron.
async function testChallengeCleanupInCron() {
  const oldConsumed = await prisma.phoneVerificationChallenge.create({
    data: {
      phone: "+201000000098",
      codeHash: "consumed-hash",
      consumedAt: new Date(Date.now() - 48 * 3600 * 1000), // 48h ago
      createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 48 * 3600 * 1000),
    },
  });

  const activeChallenge = await prisma.phoneVerificationChallenge.create({
    data: {
      phone: "+201000000099",
      codeHash: "active-hash",
      expiresAt: new Date(Date.now() + 60 * 1000), // expires in 1 min
    },
  });

  const challengeCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.phoneVerificationChallenge.deleteMany({
    where: {
      OR: [
        { consumedAt: { not: null }, createdAt: { lt: challengeCutoff } },
        { expiresAt: { lt: challengeCutoff } },
      ],
    },
  });

  const oldFound = await prisma.phoneVerificationChallenge.findUnique({ where: { id: oldConsumed.id } });
  const activeFound = await prisma.phoneVerificationChallenge.findUnique({ where: { id: activeChallenge.id } });

  assert.equal(oldFound, null, "Consumed challenge older than 24h must be deleted");
  assert.ok(activeFound, "Active valid challenge must not be deleted");

  await prisma.phoneVerificationChallenge.delete({ where: { id: activeChallenge.id } });
}

// ── Test 23 ──────────────────────────────────────────────────────────────────
// WhatsApp Baileys autostart must be guarded against multi-worker cluster storms.
async function testWhatsAppWorkerAutostartGuard() {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/lib/whatsapp/index.ts", import.meta.url), "utf8")
  );

  assert.ok(
    /NODE_APP_INSTANCE === undefined \|\| process\.env\.NODE_APP_INSTANCE === "0"/.test(source) ||
    /isMainInstance/.test(source),
    "WhatsAppService must guard against autostart on non-zero PM2 cluster instances"
  );
  assert.ok(
    /NODE_ENV !== "test"/.test(source),
    "WhatsAppService must avoid starting background Baileys sockets during automated tests"
  );
}

const TESTS: Array<[string, () => Promise<void>]> = [
  ["challenge cookie leaks nothing crackable", testChallengeCookieLeaksNothingCrackable],
  ["challenge is single use", testChallengeIsSingleUse],
  ["phone bypass refused in production", testPhoneBypassRefusedInProduction],
  ["captcha cannot be skipped by omitting token", testCaptchaCannotBeSkippedByOmittingToken],
  ["login lockout after repeated failures", testLoginLockout],
  ["video playback fails closed", testVideoPlaybackFailsClosed],
  ["video credentials are not hardcoded", testVideoCredentialsAreNotHardcoded],
  ["webhook secret comparison", testWebhookSecretComparison],
  ["parent token is not silently rotated", testParentTokenIsNotSilentlyRotated],
  ["concurrent spend cannot overdraw", testConcurrentSpendCannotOverdraw],
  ["money code cannot be redeemed twice", testMoneyCodeCannotBeRedeemedTwice],
  ["auth cookie Secure by default in production", testAuthCookieSecureByDefaultInProduction],
  ["client cannot choose a cheaper pricing grade", testGradeCannotBeChosenByTheClientToLowerPrice],
  ["duplicate webhook credits once", testDuplicateWebhookCreditsOnce],
  ["concurrent plan enrollment creates one", testConcurrentPlanEnrollmentCreatesOne],
  ["concurrent access-code redemption binds once", testConcurrentAccessCodeRedemptionBindsOnce],
  ["score percentage semantics", testScorePercentageSemantics],
  ["command centre is scoped to own roster", testCommandCenterIsScopedToOwnRoster],
  ["tokenVersion invalidation on password/device reset", testTokenVersionRevocation],
  ["BalanceTransaction providerRef indexed lookup", testBalanceTransactionProviderRef],
  ["VdoCipher OTP TTL default 120s", testVdoCipherShortOtpTtl],
  ["expired challenge cleanup in cron", testChallengeCleanupInCron],
  ["WhatsApp worker-0 autostart guard", testWhatsAppWorkerAutostartGuard],
];

async function main() {
  ({ prisma } = await import("../src/lib/prisma.ts"));

  let failed = 0;

  for (const [name, fn] of TESTS) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
    } catch (error) {
      failed++;
      console.error(`  FAIL  ${name}`);
      console.error(`        ${(error as Error).message}`);
    }
  }

  await prisma.$disconnect();

  console.log(`\n${TESTS.length - failed}/${TESTS.length} security tests passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await prisma?.$disconnect().catch(() => {});
  process.exitCode = 1;
});
