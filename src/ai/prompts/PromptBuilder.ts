import { AIContext, FinalPrompt, PromptOptions } from "../types";
import { ConfigManager } from "../config/AIConfig";

import { AdaptiveDifficulty } from "../brain/AdaptiveDifficulty";
import { LayeredTeacher } from "../brain/LayeredTeacher";
import { SubjectRulesRegistry } from "../subject_rules/SubjectRulesRegistry";

export class PromptBuilder {
  private configManager: ConfigManager;
  private subjectRulesRegistry: SubjectRulesRegistry;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || ConfigManager.getInstance();
    this.subjectRulesRegistry = SubjectRulesRegistry.getInstance();
  }

  /**
   * Dynamically composes the complete prompt structure.
   */
  public buildPrompt(options: PromptOptions): FinalPrompt {
    const config = this.configManager.getConfig();

    const studentLevel = AdaptiveDifficulty.estimateLevel(
      options.context.quizHistory,
      options.context.currentGrade,
      options.userMessage
    );
    const difficultyInstructions = AdaptiveDifficulty.getPromptInstructions(studentLevel);
    const pedagogicalSubjectRules = this.subjectRulesRegistry.getFormattedRules(
      options.context.course.subject
    );

    const isDetailedExplanationRequested =
      (options.context.currentAction as string) === "TUTOR_LESSON" ||
      options.userMessage.includes("اشرح بالتفصيل") ||
      options.userMessage.includes("شرح مفصل");
    const layeredInstructions = isDetailedExplanationRequested
      ? LayeredTeacher.getPromptInstructions()
      : `استجب مباشرة وبشكل سلس وطبيعي بدون التقيد بهياكل جامدة أو عناوين تكرارية، وركز على تلبية احتياجات الطالب بوضوح وتكيف.`;

    const identity = `أنت المساعد التعليمي الذكي الخبير لمنصة Code-UP والتعليم المصري.`;
    const teachingStyle = `نمط التدريس المعتمد: ${config.teachingStyle}\n` +
      `التزم بالطول المناسب للسؤال. أجب مباشرة وفقاً لطلب الطالب بدون مقدمات طويلة أو تمبلت ثابت مفروض.`;

    const actionInstructions = options.actionInstructions;
    const subjectRules = `${pedagogicalSubjectRules}\n\n${options.subjectRules}`;
    const contextString = this.formatContext(options.context);
    const curriculumGrounding = options.curriculumGrounding || "";
    const userMessage = options.userMessage;

    const fullPrompt = [
      `=== IDENTITY & MISSION ===`,
      identity,
      ``,
      `=== TEACHING STYLE & RESPONSE LENGTH ===`,
      teachingStyle,
      ``,
      `=== ADAPTIVE DIFFICULTY ===`,
      difficultyInstructions,
      ``,
      `=== RESPONSE GUIDELINES ===`,
      layeredInstructions,
      ``,
      `=== ACTION SPECIFIC INSTRUCTIONS ===`,
      actionInstructions,
      ``,
      `=== SUBJECT PEDAGOGICAL & FORMATTING RULES ===`,
      subjectRules,
      ``,
      `=== PLATFORM & STUDENT CONTEXT ===`,
      contextString,
      ``,
      // Placed last before the student's message so the official text is the
      // most recent thing the model reads before answering.
      ...(curriculumGrounding ? [curriculumGrounding, ``] : []),
      `=== STUDENT MESSAGE / INPUT ===`,
      userMessage,
    ].join("\n");

    return {
      identity,
      teachingStyle,
      actionInstructions,
      subjectRules,
      contextString,
      curriculumGrounding,
      userMessage,
      fullPrompt,
    };
  }

  private formatContext(ctx: AIContext): string {
    const isTester = ctx.student.isTester || ctx.student.accountMode === "TESTER";
    return [
      `- اسم الطالب: ${ctx.student.name} (المعرف: ${ctx.student.id})`,
      ...(isTester ? [`- وضع الحساب: حساب فحص وضمان جودة (QA Platform Tester) — مخصص للتشخيص والاختبار.`] : []),
      `- المرحلة الدراسية: ${ctx.currentGrade} | المسار: ${ctx.educationalTrack}`,
      `- الكورس الحالي: ${ctx.course.title} (المادة: ${ctx.course.subject})`,
      `- الدرس الحالي: ${ctx.lesson.title} (نسبة الإنجاز: ${ctx.lessonProgress.completionPercentage}%)`,
      `- النقاط التي تحتاج تقوية: ${ctx.weakChapters.join(", ") || "لا توجد نقاط ضعيفة مسجلة"}`,
      `- النقاط القوية: ${ctx.strongChapters.join(", ") || "عام"}`,
      `- الوقت المتاح للدراسة: ${ctx.availableTime} دقيقة`,
      `- إجراء الذكاء الاصطناعي الحالي: ${ctx.currentAction}`,
      `- التاريخ اليوم: ${ctx.currentDate}`,
    ].join("\n");
  }
}
