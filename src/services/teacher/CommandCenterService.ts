import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { quizResultPercent } from "@/lib/scoring";

/**
 * Teacher Command Center — deterministic, explainable student triage.
 *
 * Design constraints this file is written to satisfy:
 *
 *  - **No ML.** Every flag is a threshold comparison over authoritative rows.
 *    A teacher must be able to reproduce any number by hand.
 *  - **Status is derived, never stored.** "Behind" is a fact about the data as
 *    of now, so persisting it would create a second source of truth that drifts.
 *    Only the *thresholds* are persisted, and they are versioned.
 *  - **Evidence is mandatory.** A flag without the numbers that produced it is
 *    an accusation, not a signal — so every StudentFlag carries them.
 *  - **Pace first.** "Falling behind" means behind the schedule the student was
 *    actually given. Peer comparison is a fallback for content with no schedule,
 *    because being slower than peers is not the same as being late.
 */

// ── Vocabulary ───────────────────────────────────────────────────────────────
// Deliberately distinct concepts, kept distinct in the types:
//   status         — a current condition, derived live
//   event          — something that happened, already recorded authoritatively
//   recommendation — a suggested action, derived from status

export type StudentStatus = "BEHIND_PACE" | "DECLINING" | "INACTIVE" | "STRUGGLING_TOPIC";

export type PaceBasis = "PLAN_SCHEDULE" | "COURSE_SCHEDULE" | "PEER_FALLBACK";

export interface StudentFlag {
  status: StudentStatus;
  /** Human-readable statement of the rule that fired. */
  rule: string;
  /** The numbers behind the flag. Always populated. */
  evidence: Record<string, string | number | boolean | null>;
  recommendation: string;
}

export interface FlaggedStudent {
  studentId: string;
  studentName: string;
  educationalStage: string | null;
  flags: StudentFlag[];
}

export interface CommandCenterResult {
  teacherId: string;
  generatedAt: string;
  /** Which threshold version produced these numbers. */
  thresholdsVersion: number;
  thresholds: Thresholds;
  rosterSize: number;
  counts: Record<StudentStatus, number>;
  students: FlaggedStudent[];
  /** Signals that could not be evaluated, and why. Never silently skipped. */
  notes: string[];
}

export interface Thresholds {
  version: number;
  behindPacePercent: number;
  behindPeerPercent: number;
  decliningDropPoints: number;
  decliningWindow: number;
  inactiveDays: number;
  strugglingWrongPercent: number;
  strugglingMinAttempts: number;
}

const FALLBACK_THRESHOLDS: Thresholds = {
  version: 0,
  behindPacePercent: 80,
  behindPeerPercent: 50,
  decliningDropPoints: 15,
  decliningWindow: 3,
  inactiveDays: 7,
  strugglingWrongPercent: 40,
  strugglingMinAttempts: 5,
};

/** Reads the active threshold version, falling back to the agreed defaults. */
export async function getActiveThresholds(): Promise<Thresholds> {
  const row = await prisma.teacherAlertThresholds.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });
  if (!row) return FALLBACK_THRESHOLDS;
  return {
    version: row.version,
    behindPacePercent: row.behindPacePercent,
    behindPeerPercent: row.behindPeerPercent,
    decliningDropPoints: row.decliningDropPoints,
    decliningWindow: row.decliningWindow,
    inactiveDays: row.inactiveDays,
    strugglingWrongPercent: row.strugglingWrongPercent,
    strugglingMinAttempts: row.strugglingMinAttempts,
  };
}

/**
 * Publishes a new threshold version. Never mutates an existing row, so a figure
 * a teacher acted on last week can still be explained by the rules of that week.
 */
export async function publishThresholds(
  next: Partial<Omit<Thresholds, "version">>,
  createdById?: string,
  note?: string
): Promise<Thresholds> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.teacherAlertThresholds.findFirst({ orderBy: { version: "desc" } });
    const base = current ?? FALLBACK_THRESHOLDS;
    const version = (current?.version ?? 0) + 1;

    await tx.teacherAlertThresholds.updateMany({ where: { isActive: true }, data: { isActive: false } });

    const created = await tx.teacherAlertThresholds.create({
      data: {
        version,
        isActive: true,
        behindPacePercent: next.behindPacePercent ?? base.behindPacePercent,
        behindPeerPercent: next.behindPeerPercent ?? base.behindPeerPercent,
        decliningDropPoints: next.decliningDropPoints ?? base.decliningDropPoints,
        decliningWindow: next.decliningWindow ?? base.decliningWindow,
        inactiveDays: next.inactiveDays ?? base.inactiveDays,
        strugglingWrongPercent: next.strugglingWrongPercent ?? base.strugglingWrongPercent,
        strugglingMinAttempts: next.strugglingMinAttempts ?? base.strugglingMinAttempts,
        createdById: createdById ?? null,
        note: note ?? null,
      },
    });

    return {
      version: created.version,
      behindPacePercent: created.behindPacePercent,
      behindPeerPercent: created.behindPeerPercent,
      decliningDropPoints: created.decliningDropPoints,
      decliningWindow: created.decliningWindow,
      inactiveDays: created.inactiveDays,
      strugglingWrongPercent: created.strugglingWrongPercent,
      strugglingMinAttempts: created.strugglingMinAttempts,
    };
  });
}

// ── Roster ───────────────────────────────────────────────────────────────────

/**
 * The students a teacher is responsible for.
 *
 * Mirrors how access is actually granted elsewhere in the platform (access
 * codes, direct enrolments, teacher subscriptions) rather than inventing a new
 * notion of "my students" that could disagree with what the student can see.
 */
async function loadRoster(teacherId: string): Promise<Map<string, { name: string; educationalStage: string | null }>> {
  const courses = await prisma.course.findMany({ where: { teacherId }, select: { id: true } });
  const courseIds = courses.map((c) => c.id);

  const [codes, enrolments, subscriptions] = await Promise.all([
    courseIds.length
      ? prisma.accessCode.findMany({
          where: { courseId: { in: courseIds }, studentId: { not: null }, isActive: true },
          select: { studentId: true },
        })
      : Promise.resolve([]),
    courseIds.length
      ? prisma.courseEnrollment.findMany({ where: { courseId: { in: courseIds } }, select: { studentId: true } })
      : Promise.resolve([]),
    prisma.teacherSubscription.findMany({
      where: { teacherId, status: "active", expiresAt: { gt: new Date() } },
      select: { studentId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const row of codes) if (row.studentId) ids.add(row.studentId);
  for (const row of enrolments) ids.add(row.studentId);
  for (const row of subscriptions) ids.add(row.studentId);

  if (ids.size === 0) return new Map();

  const students = await prisma.user.findMany({
    where: { id: { in: [...ids] }, role: "student", isDeleted: false, isActive: true },
    select: { id: true, name: true, educationalStage: true },
  });

  return new Map(students.map((s) => [s.id, { name: s.name, educationalStage: s.educationalStage }]));
}

// ── Rule: behind expected pace ───────────────────────────────────────────────

interface PaceOutcome {
  basis: PaceBasis;
  expected: number;
  actual: number;
  total: number;
  percentOfExpected: number;
  label: string;
}

/** Fraction of a window that has elapsed, clamped to [0,1]. */
function elapsedFraction(start: Date, end: Date, now: Date): number {
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
}

/**
 * Pace against a plan's own schedule — the strongest signal available, because
 * the student was given an explicit start, end and ordered lesson list.
 */
async function planPace(studentId: string, now: Date): Promise<PaceOutcome | null> {
  const enrolment = await prisma.planEnrollment.findFirst({
    where: { studentId, expiresAt: { gt: now } },
    orderBy: { unlockedAt: "desc" },
    select: {
      id: true,
      unlockedAt: true,
      expiresAt: true,
      plan: { select: { title: true, lessons: { select: { id: true, requiresQuiz: true, requiresHomework: true } } } },
    },
  });

  if (!enrolment || enrolment.plan.lessons.length === 0) return null;

  const total = enrolment.plan.lessons.length;
  const fraction = elapsedFraction(enrolment.unlockedAt, enrolment.expiresAt, now);
  const expected = Math.floor(fraction * total);

  const progress = await prisma.planLessonProgress.findMany({
    where: { enrollmentId: enrolment.id },
    select: { planLessonId: true, watched: true, quizPassed: true, homeworkPassed: true },
  });

  const requirementById = new Map(enrolment.plan.lessons.map((l) => [l.id, l]));
  // "Complete" follows the platform's own gating rules rather than a looser
  // watched-only definition, so the number matches what the student sees.
  const actual = progress.filter((p) => {
    const lesson = requirementById.get(p.planLessonId);
    if (!lesson) return false;
    if (!p.watched) return false;
    if (lesson.requiresQuiz && !p.quizPassed) return false;
    if (lesson.requiresHomework && !p.homeworkPassed) return false;
    return true;
  }).length;

  return {
    basis: "PLAN_SCHEDULE",
    expected,
    actual,
    total,
    percentOfExpected: expected === 0 ? 100 : Math.round((actual / expected) * 100),
    label: enrolment.plan.title,
  };
}

/**
 * Pace against scheduled course content. Only applies where the teacher
 * actually staggered releases via publishAt — otherwise every lesson has always
 * been available and there is no schedule to be late against.
 */
async function coursePace(studentId: string, teacherId: string, now: Date): Promise<PaceOutcome | null> {
  const scheduled = await prisma.video.findMany({
    where: {
      folder: { course: { teacherId } },
      OR: [{ publishAt: { not: null } }, { folder: { publishAt: { not: null } } }],
    },
    select: { id: true, publishAt: true, folder: { select: { publishAt: true, course: { select: { title: true } } } } },
  });

  if (scheduled.length === 0) return null;

  const released = scheduled.filter((v) => {
    const effective = [v.publishAt, v.folder.publishAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
    return !effective || effective <= now;
  });

  if (released.length === 0) return null;

  const watched = await prisma.progress.count({
    where: { studentId, videoId: { in: released.map((v) => v.id) }, watched: true },
  });

  return {
    basis: "COURSE_SCHEDULE",
    expected: released.length,
    actual: watched,
    total: scheduled.length,
    percentOfExpected: Math.round((watched / released.length) * 100),
    label: scheduled[0]?.folder.course.title ?? "المنهج",
  };
}

/**
 * Fallback only. Compares against the peer median rather than a schedule, so it
 * answers "slower than classmates", which is a weaker claim — reported as such.
 */
function peerPace(studentId: string, watchedByStudent: Map<string, number>): PaceOutcome | null {
  const counts = [...watchedByStudent.values()].sort((a, b) => a - b);
  if (counts.length < 3) return null; // too few peers for a median to mean anything

  const median = counts[Math.floor(counts.length / 2)];
  if (median === 0) return null;

  const actual = watchedByStudent.get(studentId) ?? 0;
  return {
    basis: "PEER_FALLBACK",
    expected: median,
    actual,
    total: counts[counts.length - 1],
    percentOfExpected: Math.round((actual / median) * 100),
    label: "متوسط زملائه",
  };
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function buildCommandCenter(teacherId: string, now = new Date()): Promise<CommandCenterResult> {
  const thresholds = await getActiveThresholds();
  const roster = await loadRoster(teacherId);
  const notes: string[] = [];

  const studentIds = [...roster.keys()];
  const flagsByStudent = new Map<string, StudentFlag[]>();

  const addFlag = (studentId: string, flag: StudentFlag) => {
    const list = flagsByStudent.get(studentId) ?? [];
    list.push(flag);
    flagsByStudent.set(studentId, list);
  };

  if (studentIds.length === 0) {
    return {
      teacherId,
      generatedAt: now.toISOString(),
      thresholdsVersion: thresholds.version,
      thresholds,
      rosterSize: 0,
      counts: { BEHIND_PACE: 0, DECLINING: 0, INACTIVE: 0, STRUGGLING_TOPIC: 0 },
      students: [],
      notes: ["No students are linked to this teacher via access codes, enrolments or subscriptions."],
    };
  }

  // ── Peer baseline, computed once for the fallback path ────────────────────
  const watchedCounts = await prisma.progress.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds }, watched: true },
    _count: { _all: true },
  });
  const watchedByStudent = new Map<string, number>(studentIds.map((id) => [id, 0]));
  for (const row of watchedCounts) watchedByStudent.set(row.studentId, row._count._all);

  // ── Rule 1: behind expected pace ──────────────────────────────────────────
  for (const studentId of studentIds) {
    const pace =
      (await planPace(studentId, now)) ??
      (await coursePace(studentId, teacherId, now)) ??
      peerPace(studentId, watchedByStudent);

    if (!pace) continue;

    const limit = pace.basis === "PEER_FALLBACK" ? thresholds.behindPeerPercent : thresholds.behindPacePercent;
    if (pace.percentOfExpected >= limit) continue;

    addFlag(studentId, {
      status: "BEHIND_PACE",
      rule:
        pace.basis === "PEER_FALLBACK"
          ? `أنجز ${pace.percentOfExpected}% مما أنجزه متوسط زملائه (الحد ${limit}%) — لا يوجد جدول زمني محدد لهذا المحتوى`
          : `أنجز ${pace.percentOfExpected}% من المتوقع حسب الجدول (الحد ${limit}%)`,
      evidence: {
        basis: pace.basis,
        source: pace.label,
        expectedByNow: pace.expected,
        actuallyCompleted: pace.actual,
        totalInSchedule: pace.total,
        percentOfExpected: pace.percentOfExpected,
        thresholdPercent: limit,
      },
      recommendation:
        pace.basis === "PEER_FALLBACK"
          ? "راجع تقدّمه واسأله إن كان يواجه صعوبة — المقارنة هنا بالزملاء وليست بجدول محدد."
          : "تواصل معه لوضع خطة لحاق بالجدول، وابدأ بأقرب درس فاته.",
    });
  }

  // ── Rule 2: declining scores ──────────────────────────────────────────────
  const quizResults = await prisma.quizResult.findMany({
    where: { studentId: { in: studentIds }, totalQ: { gt: 0 } },
    orderBy: { completedAt: "desc" },
    select: { studentId: true, score: true, totalQ: true, completedAt: true },
  });

  const resultsByStudent = new Map<string, typeof quizResults>();
  for (const r of quizResults) {
    const list = resultsByStudent.get(r.studentId) ?? [];
    list.push(r);
    resultsByStudent.set(r.studentId, list);
  }

  for (const [studentId, results] of resultsByStudent) {
    const window = thresholds.decliningWindow;
    // Need a full recent window plus at least one earlier result to compare to.
    if (results.length < window + 1) continue;

    // QuizResult.score is already a percentage — see src/lib/scoring.ts.
    const percent = quizResultPercent;
    const recent = results.slice(0, window);
    const earlier = results.slice(window);

    const recentAvg = recent.reduce((s, r) => s + percent(r), 0) / recent.length;
    const earlierAvg = earlier.reduce((s, r) => s + percent(r), 0) / earlier.length;
    const drop = earlierAvg - recentAvg;

    if (drop < thresholds.decliningDropPoints) continue;

    addFlag(studentId, {
      status: "DECLINING",
      rule: `متوسط آخر ${window} نتائج أقل بـ ${Math.round(drop)} نقطة من متوسطه السابق (الحد ${thresholds.decliningDropPoints})`,
      evidence: {
        recentAveragePercent: Math.round(recentAvg),
        priorAveragePercent: Math.round(earlierAvg),
        dropPoints: Math.round(drop),
        thresholdPoints: thresholds.decliningDropPoints,
        recentResultsCompared: window,
        priorResultsCompared: earlier.length,
        lastResultAt: recent[0].completedAt.toISOString(),
      },
      recommendation: "راجع معه آخر اختبارات لتحديد المفاهيم التي تراجع فيها قبل أن تتراكم.",
    });
  }

  // ── Rule 3: inactive ──────────────────────────────────────────────────────
  const inactiveCutoff = new Date(now.getTime() - thresholds.inactiveDays * 86400_000);

  // Activity is measured with two passes rather than one groupBy/_max:
  //
  //   1. an exact "was there anything after the cutoff" existence check, which
  //      decides the flag, and
  //   2. a bounded recent-rows scan used only to date the evidence.
  //
  // groupBy({_max: <DateTime>}) is deliberately avoided — Prisma cannot coerce
  // SQLite's integer-encoded DateTime back through an aggregate, so it throws
  // P2023 on exactly the columns this rule needs.
  const activeSince = async (
    rows: Promise<Array<{ studentId: string }>>
  ): Promise<string[]> => (await rows).map((r) => r.studentId);

  const [activeWatch, activeQuiz, activeHomework, activeExam] = await Promise.all([
    activeSince(
      prisma.videoWatchSession.findMany({
        where: { studentId: { in: studentIds }, startedAt: { gt: inactiveCutoff } },
        select: { studentId: true },
        distinct: ["studentId"],
      })
    ),
    activeSince(
      prisma.quizResult.findMany({
        where: { studentId: { in: studentIds }, completedAt: { gt: inactiveCutoff } },
        select: { studentId: true },
        distinct: ["studentId"],
      })
    ),
    activeSince(
      prisma.homeworkSubmission.findMany({
        where: { studentId: { in: studentIds }, completedAt: { gt: inactiveCutoff } },
        select: { studentId: true },
        distinct: ["studentId"],
      })
    ),
    activeSince(
      prisma.dailyExamResult.findMany({
        where: { studentId: { in: studentIds }, completedAt: { gt: inactiveCutoff } },
        select: { studentId: true },
        distinct: ["studentId"],
      })
    ),
  ]);

  const activeStudents = new Set<string>([
    ...activeWatch,
    ...activeQuiz,
    ...activeHomework,
    ...activeExam,
  ]);

  // Evidence pass, scoped to the students already known to be inactive.
  const inactiveIds = studentIds.filter((id) => !activeStudents.has(id));
  const lastActivity = new Map<string, Date | null>(inactiveIds.map((id) => [id, null]));

  if (inactiveIds.length > 0) {
    const EVIDENCE_ROW_CAP = 2000;
    const noteMax = (studentId: string, candidate: Date | null | undefined) => {
      if (!candidate) return;
      const current = lastActivity.get(studentId) ?? null;
      if (!current || candidate > current) lastActivity.set(studentId, candidate);
    };

    const [watchRows, quizRows, homeworkRows, examRows] = await Promise.all([
      prisma.videoWatchSession.findMany({
        where: { studentId: { in: inactiveIds } },
        select: { studentId: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: EVIDENCE_ROW_CAP,
      }),
      prisma.quizResult.findMany({
        where: { studentId: { in: inactiveIds } },
        select: { studentId: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: EVIDENCE_ROW_CAP,
      }),
      prisma.homeworkSubmission.findMany({
        where: { studentId: { in: inactiveIds } },
        select: { studentId: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: EVIDENCE_ROW_CAP,
      }),
      prisma.dailyExamResult.findMany({
        where: { studentId: { in: inactiveIds } },
        select: { studentId: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: EVIDENCE_ROW_CAP,
      }),
    ]);

    for (const r of watchRows) noteMax(r.studentId, r.startedAt);
    for (const r of quizRows) noteMax(r.studentId, r.completedAt);
    for (const r of homeworkRows) noteMax(r.studentId, r.completedAt);
    for (const r of examRows) noteMax(r.studentId, r.completedAt);
  }

  for (const studentId of inactiveIds) {
    const last = lastActivity.get(studentId) ?? null;

    addFlag(studentId, {
      status: "INACTIVE",
      rule: last
        ? `لا يوجد نشاط تعليمي منذ ${Math.floor((now.getTime() - last.getTime()) / 86400_000)} يوم (الحد ${thresholds.inactiveDays})`
        : `لا يوجد أي نشاط تعليمي مسجّل (الحد ${thresholds.inactiveDays} يوم)`,
      evidence: {
        lastActivityAt: last ? last.toISOString() : null,
        daysSinceLastActivity: last ? Math.floor((now.getTime() - last.getTime()) / 86400_000) : null,
        thresholdDays: thresholds.inactiveDays,
        signalsChecked: "watch sessions, quizzes, homework, daily exams",
        // The flag itself is exact; only the date may be unknown, when the
        // student's last activity predates the evidence lookback window.
        lastActivityKnown: last !== null,
      },
      recommendation: last
        ? "تواصل معه للاطمئنان — الانقطاع المبكر أسهل في المعالجة من الانقطاع الطويل."
        : "لم يبدأ بعد — تأكد من وصوله للمحتوى ومن أن كود التفعيل يعمل.",
    });
  }

  // ── Rule 4: struggling with a topic ───────────────────────────────────────
  const answers = await prisma.quizAnswer.findMany({
    where: { studentId: { in: studentIds }, questionType: "mcq" },
    select: { studentId: true, isCorrect: true, quizId: true },
  });

  if (answers.length === 0) {
    notes.push(
      "Topic-level struggling was not evaluated: no MCQ answers are recorded (QuizAnswer is empty), so there is nothing to measure."
    );
  } else {
    const quizIds = [...new Set(answers.map((a) => a.quizId))];
    const quizzes = await prisma.quiz.findMany({
      where: { id: { in: quizIds } },
      select: { id: true, title: true, folder: { select: { id: true, name: true } } },
    });
    const topicByQuiz = new Map(
      quizzes.map((q) => [q.id, { id: q.folder?.id ?? q.id, name: q.folder?.name ?? q.title }])
    );

    const tally = new Map<string, { studentId: string; topic: string; total: number; wrong: number }>();
    for (const a of answers) {
      const topic = topicByQuiz.get(a.quizId);
      if (!topic) continue;
      const key = `${a.studentId}::${topic.id}`;
      const entry = tally.get(key) ?? { studentId: a.studentId, topic: topic.name, total: 0, wrong: 0 };
      entry.total += 1;
      if (!a.isCorrect) entry.wrong += 1;
      tally.set(key, entry);
    }

    for (const entry of tally.values()) {
      if (entry.total < thresholds.strugglingMinAttempts) continue;
      const wrongPercent = Math.round((entry.wrong / entry.total) * 100);
      if (wrongPercent < thresholds.strugglingWrongPercent) continue;

      addFlag(entry.studentId, {
        status: "STRUGGLING_TOPIC",
        rule: `أخطأ في ${wrongPercent}% من أسئلة "${entry.topic}" (الحد ${thresholds.strugglingWrongPercent}%)`,
        evidence: {
          topic: entry.topic,
          attempts: entry.total,
          incorrect: entry.wrong,
          wrongPercent,
          thresholdPercent: thresholds.strugglingWrongPercent,
          minAttemptsRequired: thresholds.strugglingMinAttempts,
        },
        recommendation: `أعد شرح "${entry.topic}" أو اعطه تمارين إضافية عليه تحديداً.`,
      });
    }
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const counts: Record<StudentStatus, number> = {
    BEHIND_PACE: 0,
    DECLINING: 0,
    INACTIVE: 0,
    STRUGGLING_TOPIC: 0,
  };

  const students: FlaggedStudent[] = [];
  for (const [studentId, flags] of flagsByStudent) {
    const profile = roster.get(studentId);
    if (!profile) continue;
    for (const f of flags) counts[f.status] += 1;
    students.push({
      studentId,
      studentName: profile.name,
      educationalStage: profile.educationalStage,
      flags,
    });
  }

  // Most-flagged first: the students needing attention soonest lead the list.
  students.sort((a, b) => b.flags.length - a.flags.length || a.studentName.localeCompare(b.studentName));

  if (watchedByStudent.size > 0 && [...watchedByStudent.values()].every((v) => v === 0)) {
    notes.push(
      "No video progress is recorded for any student on this roster, so pace fell back to plan schedules only."
    );
  }

  return {
    teacherId,
    generatedAt: now.toISOString(),
    thresholdsVersion: thresholds.version,
    thresholds,
    rosterSize: roster.size,
    counts,
    students,
    notes,
  };
}
