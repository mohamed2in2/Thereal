/** Shared enrollment checks for student course access. */
export const studentEnrollmentWhere = (studentId: string, courseId: string) => ({
  courseId,
  studentId,
  isActive: true,
});

/** Unused access code available for redemption. */
export const redeemableCodeWhere = (code: string) => ({
  code,
  studentId: null,
  isActive: true,
});
