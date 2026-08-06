export class SubjectGradeControls {
  private static instance: SubjectGradeControls;
  private disabledSubjects: Set<string> = new Set();
  private enabledGrades: Set<string> = new Set([
    "sec_1", "sec_2", "General",
  ]);

  public static getInstance(): SubjectGradeControls {
    if (!SubjectGradeControls.instance) {
      SubjectGradeControls.instance = new SubjectGradeControls();
    }
    return SubjectGradeControls.instance;
  }

  public isSubjectEnabled(subject: string): boolean {
    return !this.disabledSubjects.has(subject.toLowerCase());
  }

  public isGradeEnabled(grade: string): boolean {
    return this.enabledGrades.has(grade);
  }

  public setSubjectEnabled(subject: string, enabled: boolean): void {
    const s = subject.toLowerCase();
    if (enabled) this.disabledSubjects.delete(s);
    else this.disabledSubjects.add(s);
  }

  public setGradeEnabled(grade: string, enabled: boolean): void {
    if (enabled) this.enabledGrades.add(grade);
    else this.enabledGrades.delete(grade);
  }
}
