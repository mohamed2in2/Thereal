import { EducationalActionType } from "../../types";
import { UserRole } from "../../tools/types";

export type FeatureAccessMode = "Enabled" | "Disabled" | "Student Only" | "Teacher Only" | "Superadmin Only";

export class FeatureFlags {
  private static instance: FeatureFlags;
  private flags: Map<string, FeatureAccessMode> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): FeatureFlags {
    if (!FeatureFlags.instance) {
      FeatureFlags.instance = new FeatureFlags();
    }
    return FeatureFlags.instance;
  }

  private seedDefaults(): void {
    const actions: EducationalActionType[] = [
      "EXPLAIN", "SIMPLIFY", "SOLVE", "HINT", "QUIZ", "HOMEWORK", "REVIEW",
      "FLASHCARDS", "SUMMARY", "REVISION", "COMPARE", "EXAM", "PLAN",
      "NEXT_LESSON", "RECOMMEND", "MEMORY_TRICK", "MOTIVATE", "ANALYZE_PROGRESS",
      "PARENT_REPORT", "TEACHER_REPORT", "SEARCH_PLATFORM",
    ];

    for (const act of actions) {
      this.flags.set(act, "Enabled");
    }

    // Role-restricted defaults
    this.flags.set("PARENT_REPORT", "Teacher Only");
    this.flags.set("TEACHER_REPORT", "Teacher Only");

    // System features
    this.flags.set("OCR", "Enabled");
    this.flags.set("VOICE", "Enabled");
    this.flags.set("STREAMING", "Enabled");
    this.flags.set("TOOL_CALLING", "Enabled");
    this.flags.set("REASONING_MODE", "Enabled");
  }

  public isFeatureAllowed(featureOrAction: string, userRole: UserRole): boolean {
    const mode = this.flags.get(featureOrAction) || "Enabled";

    switch (mode) {
      case "Disabled":
        return false;
      case "Student Only":
        return userRole === "student" || userRole === "superadmin";
      case "Teacher Only":
        return userRole === "teacher" || userRole === "superadmin";
      case "Superadmin Only":
        return userRole === "superadmin";
      case "Enabled":
      default:
        return true;
    }
  }

  public setFeatureMode(featureOrAction: string, mode: FeatureAccessMode): void {
    this.flags.set(featureOrAction, mode);
  }

  public getAllFlags(): Record<string, FeatureAccessMode> {
    const res: Record<string, FeatureAccessMode> = {};
    for (const [k, v] of this.flags.entries()) {
      res[k] = v;
    }
    return res;
  }
}
