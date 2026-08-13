import { prisma } from "./prisma";

/** The demo teacher's user id, or null if none is seeded. Cached per process. */
let cachedDemoTeacherId: string | null | undefined;

export async function getDemoTeacherId(): Promise<string | null> {
  if (cachedDemoTeacherId !== undefined) return cachedDemoTeacherId;
  const demo = await prisma.user.findFirst({
    where: { isDemo: true, role: "teacher" },
    select: { id: true },
  });
  cachedDemoTeacherId = demo?.id ?? null;
  return cachedDemoTeacherId;
}

/**
 * Resets the in-memory demo teacher ID cache (e.g. after seeding or teardown).
 */
export function resetDemoTeacherIdCache(): void {
  cachedDemoTeacherId = undefined;
}

/**
 * True when a superadmin or a QA Platform Tester is viewing content owned by the demo teacher.
 * Required: valid demo teacher content owner, and viewer must be superadmin or QA Tester.
 */
export async function canBypassPayment(
  viewerRole: string | null | undefined,
  contentOwnerId: string | null | undefined,
  accountMode?: string | null | undefined
): Promise<boolean> {
  const isSuper = viewerRole === "superadmin";
  const isTester = accountMode === "TESTER";
  if (!isSuper && !isTester) return false;
  if (!contentOwnerId) return false;
  const demoId = await getDemoTeacherId();
  return demoId !== null && contentOwnerId === demoId;
}
