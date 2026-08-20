/**
 * Code-UP AI Engine Core Type Definitions
 * Milestone 1 Architecture
 */

// ============================================================================
// EDUCATIONAL ACTIONS & INTENTS
// ============================================================================

export type EducationalActionType =
  | "EXPLAIN"
  | "SIMPLIFY"
  | "SOLVE"
  | "HINT"
  | "QUIZ"
  | "HOMEWORK"
  | "REVIEW"
  | "FLASHCARDS"
  | "SUMMARY"
  | "REVISION"
  | "COMPARE"
  | "EXAM"
  | "PLAN"
  | "NEXT_LESSON"
  | "RECOMMEND"
  | "MEMORY_TRICK"
  | "MOTIVATE"
  | "ANALYZE_PROGRESS"
  | "PARENT_REPORT"
  | "TEACHER_REPORT"
  | "SEARCH_PLATFORM";

export type ResponseFormatType =
  | "markdown"
  | "bullets"
  | "equations"
  | "tables"
  | "flashcards"
  | "quiz_cards"
  | "study_plan"
  | "summary"
  | "explanation"
  | "example";

export interface EducationalIntent {
  intentName: string;
  action: EducationalActionType;
  confidence: number;
  parameters: Record<string, unknown>;
}

export interface EducationalAction {
  type: EducationalActionType;
  name: string;
  description: string;
  getPromptInstructions(context: AIContext, params?: Record<string, unknown>): string;
  validateParams?(params: Record<string, unknown>): boolean;
  getPreferredFormat(): ResponseFormatType;
}

// ============================================================================
// CONTEXT & MEMORY
// ============================================================================

export interface StudentContext {
  id: string;
  name: string;
  email?: string;
  accountMode?: string;
  isTester?: boolean;
}

export interface CourseContext {
  id: string;
  title: string;
  subject: string;
}

export interface LessonContext {
  id: string;
  title: string;
  order?: number;
}

export interface LessonProgressContext {
  watched: boolean;
  completionPercentage: number;
}

export interface CurrentQuizContext {
  id?: string;
  title?: string;
  totalQuestions?: number;
}

export interface QuizHistoryItem {
  quizId: string;
  quizTitle?: string;
  score: number;
  date: Date | string;
}

export interface HomeworkStatusContext {
  pendingCount: number;
  completedCount: number;
}

export interface StudyPlanContext {
  id?: string;
  targetGoals?: string[];
  currentModule?: string;
}

export interface PlatformSettingsContext {
  theme?: string;
  maxTokenBudget?: number;
  strictMode?: boolean;
}

export type LearningPreference = "visual" | "text" | "interactive" | "auditory" | "balanced";

export interface AIContext {
  student: StudentContext;
  currentGrade: string;
  educationalTrack: string;
  language: string;
  course: CourseContext;
  lesson: LessonContext;
  lessonProgress: LessonProgressContext;
  currentQuiz: CurrentQuizContext;
  quizHistory: QuizHistoryItem[];
  homeworkStatus: HomeworkStatusContext;
  studyPlan: StudyPlanContext;
  weakChapters: string[];
  strongChapters: string[];
  availableTime: number; // in minutes
  learningPreference: LearningPreference;
  platformSettings: PlatformSettingsContext;
  currentDate: string;
  currentAction: EducationalActionType;
}

// ============================================================================
// PROMPTS & KNOWLEDGE
// ============================================================================

export interface PromptOptions {
  userMessage: string;
  context: AIContext;
  actionInstructions: string;
  subjectRules: string;
  /** Official curriculum extracts to ground the answer in, if any were found. */
  curriculumGrounding?: string;
}

export interface FinalPrompt {
  identity: string;
  teachingStyle: string;
  actionInstructions: string;
  subjectRules: string;
  contextString: string;
  curriculumGrounding: string;
  userMessage: string;
  fullPrompt: string;
}

export interface SubjectKnowledge {
  subject: string;
  identityRules: string[];
  teachingRules: string[];
  subjectRules: string[];
  formattingRules: string[];
}

// ============================================================================
// PROVIDERS & GENERATION
// ============================================================================

export interface GenerateOptions {
  prompt: string | FinalPrompt;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  providerId: string;
  providerName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  finishReason?: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface StreamResult {
  fullText: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface EmbedResult {
  embeddings: number[][];
  dimensions: number;
  providerId: string;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
}

export interface AIProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncGenerator<StreamChunk, StreamResult, unknown>;
  embed(text: string | string[]): Promise<EmbedResult>;
  healthCheck(): Promise<boolean>;
  estimateTokens(text: string): number;
}

// ============================================================================
// VALIDATION & FORMATTING
// ============================================================================

export type ValidationErrorType =
  | "empty"
  | "unsafe"
  | "hallucination"
  | "formatting"
  | "language"
  | "relevance";

export interface ValidationResult {
  isValid: boolean;
  errorType?: ValidationErrorType;
  reason?: string;
  score: number; // 0 to 1
  sanitizedContent?: string;
}

export interface FormattedResponse {
  rawContent: string;
  formatType: ResponseFormatType;
  renderedContent: string;
  structuredData?: Record<string, unknown>;
}

// ============================================================================
// TELEMETRY & METRICS
// ============================================================================

export interface TelemetryEvent {
  id: string;
  timestamp: Date;
  latencyMs: number;
  provider: string;
  estimatedTokens: number;
  inputTokens: number;
  outputTokens: number;
  failures: number;
  retries: number;
  action: EducationalActionType;
  subject: string;
  grade: string;
  successRate: number;
  success: boolean;
  error?: string;
}

export interface TelemetryMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  requestsByAction: Record<EducationalActionType, number>;
  requestsByProvider: Record<string, number>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  weight?: number;
}

export interface AIConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  providers: Record<string, ProviderConfig>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryCount: number;
  streamingEnabled: boolean;
  cachingEnabled: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
  teachingStyle: string;
}

// ============================================================================
// ENGINE INPUT & OUTPUT
// ============================================================================

export interface EngineRequest {
  userMessage: string;
  studentId?: string;
  subject?: string;
  grade?: string;
  actionOverride?: EducationalActionType;
  params?: Record<string, unknown>;
  contextOverride?: Partial<AIContext>;
  /** Narrows curriculum retrieval to where the student currently is. */
  curriculumScope?: CurriculumScope;
}

import { CurriculumScope } from "../knowledge/curriculum/types";
import { ContinuousObservation } from "../observations/StudentObservationEngine";
import { DecisionReasoningMetadata } from "../explainability/DecisionExplainer";
import { StudentEducationalState } from "../state_machine/StudentStateMachine";

export interface EngineResponse {
  success: boolean;
  action: EducationalActionType;
  formattedResponse: FormattedResponse;
  telemetry: TelemetryEvent;
  /** Student-safe locations (lesson + page) the answer was grounded in. */
  curriculumCitations?: string[];
  usedOfficialCurriculum?: boolean;
  observation?: ContinuousObservation;
  decisionMetadata?: DecisionReasoningMetadata;
  educationalState?: StudentEducationalState;
  error?: string;
}
