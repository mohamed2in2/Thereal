import { EducationalActionType } from "../../types";

export type UserRole = "student" | "teacher" | "superadmin" | "anonymous";

export interface ToolExecutionContext {
  userId: string;
  userRole: UserRole;
  subject?: string;
  courseId?: string;
  lessonId?: string;
  quizId?: string;
  homeworkId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
  error?: string;
  executionTimeMs: number;
  fromCache?: boolean;
}

export interface ToolParameterSchema {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
}

export interface AITool {
  name: string;
  description: string;
  category: string;
  allowedRoles: UserRole[];
  cacheable: boolean;
  ttlMs?: number;
  educationalAction?: EducationalActionType;
  parameters(): ToolParameterSchema[];
  validate(params?: Record<string, unknown>): boolean;
  execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<ToolExecutionResult>;
  health(): Promise<boolean>;
}
