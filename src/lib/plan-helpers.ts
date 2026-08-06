type PlanPricing = {
  price: number;
  discountPrice: number | null;
  discountExpiresAt: Date | null;
};

/**
 * Calculates the effective price of a plan.
 * Reverts to the base price if the discount has expired.
 */
export function getEffectivePlanPrice(plan: PlanPricing): number {
  if (
    plan.discountPrice !== null &&
    plan.discountExpiresAt !== null &&
    plan.discountExpiresAt.getTime() > Date.now()
  ) {
    return plan.discountPrice;
  }
  return plan.price;
}

/**
 * Checks if a plan enrollment is still active (not expired).
 */
export function isPlanEnrollmentValid(enrollment: { expiresAt: Date }): boolean {
  return enrollment.expiresAt.getTime() > Date.now();
}

type LessonDef = {
  id: string;
  order: number;
  gatesNextLesson: boolean;
  requiresQuiz: boolean;
  requiresHomework: boolean;
  hasProject: boolean;
};

type ProgressDef = {
  planLessonId: string;
  watched: boolean;
  quizPassed: boolean;
  homeworkPassed: boolean;
  projectPassed: boolean | null;
};

/**
 * Determines if a student can access a specific lesson in a plan based on their progress.
 * Validates that all prior lessons with `gatesNextLesson=true` have been fully completed.
 */
export function canAccessPlanLesson(
  enrollment: { expiresAt: Date },
  lessonOrder: number,
  allLessons: LessonDef[],
  allProgress: ProgressDef[]
): boolean {
  if (!isPlanEnrollmentValid(enrollment)) {
    // If enrollment is expired, they can't access any new content
    // Note: The UI may still show past progress as read-only.
    return false;
  }

  // Find all lessons before this one that act as gates
  const gatingLessons = allLessons
    .filter((l) => l.order < lessonOrder && l.gatesNextLesson)
    .sort((a, b) => a.order - b.order);

  // If any gating lesson is not fully completed, access to the current lesson is denied
  for (const gate of gatingLessons) {
    const p = allProgress.find((prog) => prog.planLessonId === gate.id);
    if (!p) return false; // No progress record at all -> not completed
    
    if (!p.watched) return false;
    if (gate.requiresQuiz && !p.quizPassed) return false;
    if (gate.requiresHomework && !p.homeworkPassed) return false;
    if (gate.hasProject && !p.projectPassed) return false;
  }

  return true;
}
