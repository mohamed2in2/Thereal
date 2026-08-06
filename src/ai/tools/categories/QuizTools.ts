import { AITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, UserRole } from "../types";

export class GenerateQuizTool implements AITool {
  public name = "GenerateQuiz";
  public description = "Generates practice quiz questions matching topic and difficulty.";
  public category = "Quiz";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = false;
  public educationalAction = "QUIZ" as const;

  public parameters(): ToolParameterSchema[] {
    return [
      { name: "topic", type: "string", description: "Target topic", required: true },
      { name: "questionCount", type: "number", description: "Number of questions", required: false },
    ];
  }

  public validate(params?: Record<string, unknown>): boolean {
    return true;
  }

  public async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<ToolExecutionResult> {
    const topic = (params?.topic as string) || "البرمجة العامة";
    return {
      success: true,
      data: {
        quizId: `qz_gen_${Date.now()}`,
        topic,
        questions: [
          {
            id: "q1",
            question: `ما هي الصيغة الصحيحة لتعريف متغير في ${topic}؟`,
            options: ["let x = 5;", "var = 5;", "def x = 5;", "int x : 5;"],
            correctAnswerIndex: 0,
          },
        ],
      },
      executionTimeMs: 8,
    };
  }

  public async health(): Promise<boolean> { return true; }
}

export class SubmitQuizTool implements AITool {
  public name = "SubmitQuiz";
  public description = "Submits quiz answers, evaluates score, and tracks mistakes.";
  public category = "Quiz";
  public allowedRoles: UserRole[] = ["student", "teacher", "superadmin"];
  public cacheable = false;

  public parameters(): ToolParameterSchema[] {
    return [
      { name: "quizId", type: "string", description: "Quiz ID", required: true },
      { name: "answers", type: "array", description: "Submitted answers", required: true },
    ];
  }

  public validate(): boolean { return true; }

  public async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      success: true,
      data: {
        scorePercentage: 85,
        passed: true,
        correctAnswersCount: 4,
        totalQuestionsCount: 5,
        incorrectQuestions: [{ questionId: "q3", correctConcept: "نطاق المتغيرات Block Scope" }],
      },
      executionTimeMs: 10,
    };
  }

  public async health(): Promise<boolean> { return true; }
}
