import { prisma } from "./prisma";

export interface TesterCapabilities {
  bypassPayment: boolean;
  unlimitedWatches: boolean;
  isolatedExams: boolean;
  aiTesterContext: boolean;
}

export const DEFAULT_TESTER_CAPABILITIES: TesterCapabilities = {
  bypassPayment: true,
  unlimitedWatches: true,
  isolatedExams: true,
  aiTesterContext: true,
};

/**
 * Pure derived helper to determine if a user is a QA Platform Tester.
 * Authoritatively driven ONLY by accountMode === "TESTER".
 */
export function isTester(user: { accountMode?: string | null } | null | undefined): boolean {
  if (!user) return false;
  return user.accountMode === "TESTER";
}

/**
 * Parses and returns the active capabilities for a tester user.
 */
export function getTesterCapabilities(
  user: { accountMode?: string | null; testerCapabilities?: string | null } | null | undefined
): TesterCapabilities {
  if (!isTester(user)) {
    return {
      bypassPayment: false,
      unlimitedWatches: false,
      isolatedExams: false,
      aiTesterContext: false,
    };
  }

  if (!user?.testerCapabilities) {
    return { ...DEFAULT_TESTER_CAPABILITIES };
  }

  try {
    const parsed = JSON.parse(user.testerCapabilities);
    return {
      bypassPayment: parsed.bypassPayment !== false,
      unlimitedWatches: parsed.unlimitedWatches !== false,
      isolatedExams: parsed.isolatedExams !== false,
      aiTesterContext: parsed.aiTesterContext !== false,
    };
  } catch {
    return { ...DEFAULT_TESTER_CAPABILITIES };
  }
}

export function canBypassPayment(
  user: { accountMode?: string | null; testerCapabilities?: string | null } | null | undefined
): boolean {
  return getTesterCapabilities(user).bypassPayment;
}

export function canWatchUnlimited(
  user: { accountMode?: string | null; testerCapabilities?: string | null } | null | undefined
): boolean {
  return getTesterCapabilities(user).unlimitedWatches;
}

export function hasIsolatedExams(
  user: { accountMode?: string | null; testerCapabilities?: string | null } | null | undefined
): boolean {
  return getTesterCapabilities(user).isolatedExams;
}

export function isAiTester(
  user: { accountMode?: string | null; testerCapabilities?: string | null } | null | undefined
): boolean {
  return getTesterCapabilities(user).aiTesterContext;
}

/**
 * Logs a QA Tester action to the audit trail for debugging and platform diagnostics.
 */
export async function logTesterActivity(params: {
  testerId: string;
  action: "COURSE_ACCESS" | "VIDEO_WATCH" | "EXAM_ATTEMPT" | "AI_CONVERSATION" | "PAYMENT_BYPASS";
  targetId?: string;
  targetTitle?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string | null;
  tx?: any;
}) {
  try {
    const db = params.tx || prisma;
    const detailsStr = typeof params.details === "object" ? JSON.stringify(params.details) : params.details;
    await db.testerActivityLog.create({
      data: {
        testerId: params.testerId,
        action: params.action,
        targetId: params.targetId ?? null,
        targetTitle: params.targetTitle ?? null,
        details: detailsStr ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[logTesterActivity] Error writing tester activity log:", error);
  }
}
