import { EducationalActionType } from "../../types";
import { ProviderGroupType } from "../orchestration/AdvancedProviderOrchestrator";

export class TaskOptimizer {
  public static classifyTask(action: EducationalActionType, userMessage: string): ProviderGroupType {
    const msg = userMessage.toLowerCase();

    if (msg.includes("حل المعادلة") || msg.includes("معادلة تفاضلية") || action === "SOLVE" || action === "EXAM") {
      return "Reasoning";
    }

    if (msg.includes("صورة") || msg.includes("رسم بياني") || msg.includes("ملف pdf")) {
      return "Vision";
    }

    if (action === "SUMMARY" || action === "HINT" || action === "SIMPLIFY") {
      return "Fast";
    }

    if (action === "PARENT_REPORT" || action === "TEACHER_REPORT" || action === "PLAN") {
      return "Balanced";
    }

    return "Fast";
  }
}
