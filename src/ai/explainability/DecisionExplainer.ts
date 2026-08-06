import { EducationalActionType } from "../types";
import { StudentEducationalState } from "../state_machine/StudentStateMachine";
import { StudentLevel } from "../brain/AdaptiveDifficulty";

export interface DecisionReasoningMetadata {
  selectedAction: EducationalActionType;
  toolsUsed: string[];
  confidence: number;
  retrievedKnowledgeSources: string[];
  estimatedStudentLevel: StudentLevel;
  detectedEducationalState: StudentEducationalState;
  explanationSummary: string;
}

export class DecisionExplainer {
  public static createExplanation(
    action: EducationalActionType,
    toolsUsed: string[],
    confidence: number,
    retrievedSources: string[],
    level: StudentLevel,
    state: StudentEducationalState
  ): DecisionReasoningMetadata {
    return {
      selectedAction: action,
      toolsUsed,
      confidence,
      retrievedKnowledgeSources: retrievedSources,
      estimatedStudentLevel: level,
      detectedEducationalState: state,
      explanationSummary: `AI engine routed request to '${action}' with confidence ${Math.round(confidence * 100)}% for student at level '${level}' in state '${state}'. Tools used: [${toolsUsed.join(", ")}].`,
    };
  }
}
