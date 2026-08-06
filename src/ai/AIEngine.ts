import { ActionRouter } from "./router/ActionRouter";
import { ConfigManager } from "./config/AIConfig";
import { ContextBuilder } from "./context/ContextBuilder";
import { IntentDetector } from "./intent/IntentDetector";
import { KnowledgeLoader } from "./knowledge/KnowledgeLoader";
import { MemoryManager } from "./memory/MemoryManager";
import { PromptBuilder } from "./prompts/PromptBuilder";
import { ProviderManager } from "./providers/ProviderManager";
import { ResponseFormatter } from "./formatter/ResponseFormatter";
import { ResponseValidator } from "./validators/ResponseValidator";
import { Telemetry } from "./telemetry/Telemetry";
import { AdaptiveDifficulty } from "./brain/AdaptiveDifficulty";
import { StudentObservationEngine } from "./observations/StudentObservationEngine";
import { AIGateway } from "./gateway/AIGateway";
import { StudentStateMachine } from "./state_machine/StudentStateMachine";
import { TeachingStrategyAdapter } from "./state_machine/TeachingStrategyAdapter";
import { PlatformContextInjector } from "./tools/injector/PlatformContextInjector";
import { DecisionExplainer } from "./explainability/DecisionExplainer";
import { registerAllTools } from "./tools/categories";
import { GlobalSwitch } from "./admin/controls/GlobalSwitch";
import { FeatureFlags } from "./admin/controls/FeatureFlags";
import { SubjectGradeControls } from "./admin/controls/SubjectGradeControls";
import { ModerationEngine } from "./admin/safety/ModerationEngine";
import { CostManager } from "./admin/cost_analytics/CostManager";
import { AINotificationCenter } from "./admin/notifications/AINotificationCenter";
import { AIFirewall } from "./production/security/AIFirewall";
import { TaskOptimizer } from "./production/optimizers/TaskOptimizer";
import { PromptOptimizer } from "./production/optimizers/PromptOptimizer";
import { ResponseOptimizer } from "./production/optimizers/ResponseOptimizer";
import { EvaluationFramework } from "./production/eval/EvaluationFramework";
import { EventSubscribers } from "./events/EventSubscribers";
import { EngineRequest, EngineResponse, GenerateResult } from "./types";
import { SimilarQuestionDetector } from "./providers/cost/SimilarQuestionDetector";
import { DailyBudgetManager } from "./providers/cost/DailyBudgetManager";
import { PromptBudgetManager } from "./providers/cost/PromptBudgetManager";

export class AIEngine {
  private configManager: ConfigManager;
  private intentDetector: IntentDetector;
  private actionRouter: ActionRouter;
  private contextBuilder: ContextBuilder;
  private knowledgeLoader: KnowledgeLoader;
  private promptBuilder: PromptBuilder;
  private providerManager: ProviderManager;
  private gateway: AIGateway;
  private stateMachine: StudentStateMachine;
  private contextInjector: PlatformContextInjector;
  private validator: ResponseValidator;
  private formatter: ResponseFormatter;
  private telemetry: Telemetry;
  private memoryManager: MemoryManager;

  constructor(
    configManager?: ConfigManager,
    providerManager?: ProviderManager,
    actionRouter?: ActionRouter
  ) {
    this.configManager = configManager || ConfigManager.getInstance();
    this.intentDetector = new IntentDetector();
    this.actionRouter = actionRouter || new ActionRouter();
    this.contextBuilder = new ContextBuilder();
    this.knowledgeLoader = new KnowledgeLoader();
    this.promptBuilder = new PromptBuilder(this.configManager);
    this.providerManager = providerManager || new ProviderManager();
    this.gateway = new AIGateway(this.providerManager);
    this.stateMachine = new StudentStateMachine("EXPLORING");
    this.contextInjector = new PlatformContextInjector();
    this.validator = new ResponseValidator();
    this.formatter = new ResponseFormatter();
    this.telemetry = Telemetry.getInstance();
    this.memoryManager = MemoryManager.getInstance();

    // Register all tools and default event subscribers
    registerAllTools();
    EventSubscribers.registerDefaultSubscribers();
  }

  /**
   * Main Pipeline Execution:
   * Student Request -> Admin Controls & Moderation -> Intent Detector -> Action Router
   * -> Context Builder -> Knowledge Loader -> Prompt Builder -> Provider -> Output Validator (retry 1x)
   * -> Formatter -> Response & Telemetry & Cost Accounting
   */
  public async processRequest(request: EngineRequest): Promise<EngineResponse> {
    const startTime = Date.now();
    let retries = 0;
    let failures = 0;

    // 0. Global AI Kill Switch Check
    if (!GlobalSwitch.getInstance().isAIEnabled()) {
      const errorText = GlobalSwitch.getInstance().getDisabledMessage();
      return {
        success: false,
        action: "EXPLAIN",
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "global_kill_switch",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: "EXPLAIN",
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    // 0.1 AI Moderation & Security Inspection
    const moderationRes = new ModerationEngine().inspectMessage(request.userMessage);
    if (moderationRes.flagged && moderationRes.action === "Block") {
      AINotificationCenter.getInstance().notify(
        "JailbreakAttempt",
        "محاولة اختراق أمني أو تجاوز حماية",
        `تم حجب رسالة من المستخدم (${request.studentId || "anon"}): ${moderationRes.reason}`,
        "critical"
      );

      const errorText = `[حظر أمني]: ${moderationRes.reason}`;
      return {
        success: false,
        action: "EXPLAIN",
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "moderation_blocked",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: "EXPLAIN",
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    // 0.15 Enterprise AI Firewall Check
    const firewallRes = AIFirewall.inspectRequest(request.studentId || "anon", request.userMessage);
    if (!firewallRes.allowed) {
      const errorText = `[جدار الحماية AI Firewall]: ${firewallRes.reason}`;
      return {
        success: false,
        action: "EXPLAIN",
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "ai_firewall_blocked",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: "EXPLAIN",
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    // Stage 1: Intent Detection
    const intent = this.intentDetector.detectIntent(
      request.userMessage,
      request.actionOverride,
      request.params
    );

    // Stage 2: Action Routing
    const action = this.actionRouter.route(intent);

    // 0.2 Feature Flags & Subject/Grade Control Checks
    if (!FeatureFlags.getInstance().isFeatureAllowed(action.type, "student")) {
      const errorText = `خاصية (${action.name}) غير مفعلة حالياً على المنصة.`;
      return {
        success: false,
        action: action.type,
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "feature_flag_disabled",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: action.type,
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    if (request.subject && !SubjectGradeControls.getInstance().isSubjectEnabled(request.subject)) {
      const errorText = `مادة (${request.subject}) غير مفعّل بها الذكاء الاصطناعي حالياً.`;
      return {
        success: false,
        action: action.type,
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "subject_disabled",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: action.type,
          subject: request.subject,
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    // 0.3 Cost-Aware Routing: Similar Question Detection (>90% similarity)
    const cachedSimilar = SimilarQuestionDetector.getInstance().findSimilarAnswer(request.userMessage, 0.9);
    if (cachedSimilar) {
      const formattedResponse = this.formatter.format(cachedSimilar, action.getPreferredFormat());
      return {
        success: true,
        action: action.type,
        formattedResponse,
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "similar_question_cache",
          estimatedTokens: 50,
          inputTokens: 20,
          outputTokens: 30,
          failures: 0,
          retries: 0,
          action: action.type,
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 1.0,
          success: true,
        }),
      };
    }

    // 0.4 Cost-Aware Routing: Daily & Hourly Spending Budget Check
    const budgetCheck = DailyBudgetManager.getInstance().checkBudget(request.studentId || "anon");
    if (!budgetCheck.allowed) {
      const errorText = budgetCheck.reason || "تجاوزت المنصة الحد الأقصى للميزانية المخصصة للذكاء الاصطناعي.";
      return {
        success: false,
        action: action.type,
        formattedResponse: this.formatter.format(errorText, "markdown"),
        telemetry: this.telemetry.recordEvent({
          latencyMs: Date.now() - startTime,
          provider: "daily_budget_exceeded",
          estimatedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          failures: 1,
          retries: 0,
          action: action.type,
          subject: request.subject || "General",
          grade: request.grade || "General",
          successRate: 0,
          success: false,
          error: errorText,
        }),
        error: errorText,
      };
    }

    // Stage 3: Context Building & Automatic Platform Context Injection
    let context = this.contextBuilder.buildContext({
      studentId: request.studentId,
      subject: request.subject,
      grade: request.grade,
      action: action.type,
      overrides: request.contextOverride,
    });

    if (request.studentId) {
      context = await this.contextInjector.autoInjectContext(request.studentId, {}, context);
    }

    // Stage 4: Knowledge Loading
    const subjectRules = this.knowledgeLoader.getRulesString(context.course.subject);

    // Stage 5: Prompt Building
    const actionInstructions = action.getPromptInstructions(context, request.params);
    let finalPrompt = this.promptBuilder.buildPrompt({
      userMessage: request.userMessage,
      context,
      actionInstructions,
      subjectRules,
    });

    // Context compression check if prompt is too large
    const estimatedInputTokens = this.providerManager.getProvider().estimateTokens(finalPrompt.fullPrompt);
    const maxBudget = context.platformSettings.maxTokenBudget || 4000;
    if (estimatedInputTokens > maxBudget) {
      context = this.contextBuilder.compressContext(context);
      finalPrompt = this.promptBuilder.buildPrompt({
        userMessage: request.userMessage,
        context,
        actionInstructions,
        subjectRules,
      });
    }

    // Stage 6 & 7: AI Gateway Execution & Provider Fallback
    let genResult: GenerateResult;
    let usedFallback = false;

    try {
      const config = this.configManager.getConfig();
      const gatewayResult = await this.gateway.executeRequest(
        request.studentId || "anon",
        action.type,
        {
          prompt: finalPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeoutMs: config.timeoutMs,
        }
      );

      genResult = gatewayResult.result;

      CostManager.getInstance().recordCost({
        providerId: genResult.providerId,
        subject: context.course.subject,
        grade: context.currentGrade,
        action: action.type,
        userId: request.studentId || "anon",
        inputTokens: genResult.inputTokens,
        outputTokens: genResult.outputTokens,
        costUsd: gatewayResult.costEstimateUsd,
      });
    } catch (err: unknown) {
      failures++;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const fallbackText = this.validator.getGracefulFallback(errorMessage);
      const formattedResponse = this.formatter.format(fallbackText, action.getPreferredFormat());

      const latencyMs = Date.now() - startTime;
      const telemetryEvent = this.telemetry.recordEvent({
        latencyMs,
        provider: "error_fallback",
        estimatedTokens: estimatedInputTokens,
        inputTokens: estimatedInputTokens,
        outputTokens: 50,
        failures: 1,
        retries,
        action: action.type,
        subject: context.course.subject,
        grade: context.currentGrade,
        successRate: 0,
        success: false,
        error: errorMessage,
      });

      return {
        success: false,
        action: action.type,
        formattedResponse,
        telemetry: telemetryEvent,
        error: errorMessage,
      };
    }

    // Stage 8: Output Validation (Retry once if invalid)
    let validation = this.validator.validate(genResult.text, context.language);

    if (!validation.isValid && retries === 0) {
      retries++;
      // Retry once with stricter options
      try {
        const retryRes = await this.providerManager.generateWithFallback({
          prompt: finalPrompt,
          temperature: 0.2,
          maxTokens: this.configManager.getConfig().maxTokens,
        });
        genResult = retryRes.result;
        validation = this.validator.validate(genResult.text, context.language);
      } catch {
        failures++;
      }
    }

    let finalContent = genResult.text;
    if (!validation.isValid) {
      failures++;
      finalContent = this.validator.getGracefulFallback(validation.reason);
    }

    // Stage 9: Formatting Output
    const formattedResponse = this.formatter.format(
      finalContent,
      action.getPreferredFormat()
    );

    // Record answer in similar question detector cache & daily budget spent
    if (validation.isValid) {
      SimilarQuestionDetector.getInstance().recordAnswer(request.userMessage, formattedResponse.renderedContent);
      DailyBudgetManager.getInstance().recordSpent(request.studentId || "anon", genResult?.outputTokens ? (genResult.inputTokens * 0.00000015 + genResult.outputTokens * 0.0000006) : 0.0005);
    }

    // Save turn to memory session
    if (request.studentId) {
      this.memoryManager.addMessage(request.studentId, {
        role: "user",
        content: request.userMessage,
        action: action.type,
      });
      this.memoryManager.addMessage(request.studentId, {
        role: "assistant",
        content: formattedResponse.renderedContent,
        action: action.type,
      });
    }

    // Stage 10: Telemetry Recording & Continuous Learning Observations & Explainability
    const latencyMs = Date.now() - startTime;
    const isSuccess = validation.isValid && failures === 0;

    const currentLevel = AdaptiveDifficulty.estimateLevel(
      context.quizHistory,
      context.currentGrade,
      request.userMessage
    );

    const observation = StudentObservationEngine.generateObservation(
      request.userMessage,
      action.type,
      currentLevel,
      isSuccess,
      context.weakChapters,
      context.strongChapters
    );

    const decisionMetadata = DecisionExplainer.createExplanation(
      action.type,
      ["GetStudentProfile", "GetCurrentCourse", "GetLesson"],
      intent.confidence,
      [context.course.subject, context.lesson.title],
      currentLevel,
      this.stateMachine.getState()
    );

    const telemetryEvent = this.telemetry.recordEvent({
      latencyMs,
      provider: genResult.providerId,
      estimatedTokens: estimatedInputTokens,
      inputTokens: genResult.inputTokens,
      outputTokens: genResult.outputTokens,
      failures,
      retries,
      action: action.type,
      subject: context.course.subject,
      grade: context.currentGrade,
      successRate: isSuccess ? 1.0 : 0.0,
      success: isSuccess,
    });

    return {
      success: isSuccess,
      action: action.type,
      formattedResponse,
      telemetry: telemetryEvent,
      observation,
      decisionMetadata,
      educationalState: this.stateMachine.getState(),
    };
  }

  // Helper accessors for sub-systems
  public getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  public getConfigManager(): ConfigManager {
    return this.configManager;
  }

  public getActionRouter(): ActionRouter {
    return this.actionRouter;
  }

  public getTelemetry(): Telemetry {
    return this.telemetry;
  }
}
