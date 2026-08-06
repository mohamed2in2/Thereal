import { BaseProvider } from "./BaseProvider";
import { GenerateOptions, GenerateResult, ProviderCapabilities } from "../types";

export class MockProvider extends BaseProvider {
  public id = "mock";
  public name = "Code-UP Mock Educational AI Provider";
  public capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: false,
    maxContextTokens: 128000,
  };

  private extractUserQuery(promptText: string): string {
    if (promptText.includes("=== STUDENT MESSAGE / INPUT ===")) {
      const parts = promptText.split("=== STUDENT MESSAGE / INPUT ===");
      return parts[parts.length - 1].trim();
    }
    return promptText.trim();
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const promptText = this.extractPromptText(options.prompt);
    const inputTokens = this.estimateTokens(promptText);
    const userQuery = this.extractUserQuery(promptText);
    const queryLower = userQuery.toLowerCase();

    let outputText = "";

    // 1. Check for Developer / Version / Capabilities / Limit Questions
    if (
      queryLower.includes("developer") ||
      queryLower.includes("version") ||
      queryLower.includes("provider") ||
      queryLower.includes("haiku") ||
      queryLower.includes("deepseek") ||
      queryLower.includes("gemini") ||
      userQuery.includes("المطور") ||
      userQuery.includes("الإصدار") ||
      userQuery.includes("اصدار") ||
      userQuery.includes("الحد الأقصى") ||
      userQuery.includes("ماذا يمكنك")
    ) {
      outputText = `أهلاً بك عزيزي المطور! 👋\n\n` +
        `### معلومات المحرك والمساعد الذكي (Code-UP AI System)\n\n` +
        `- **الإصدار ومزود الخدمة (Provider)**: يعتمد المحرك على نظام متعدد المزودين (Multi-Provider Framework)، يدعم الربط مع **DeepSeek V4 Flash**, **Google Gemini**, **Anthropic Claude**, و **OpenAI GPT-4o** مع نظام حماية وتحويل تلقائي (Fallback Chain).\n` +
        `- **القدرات والإمكانيات**: \n` +
        `  1. الشرح التفاعلي والإجابة على الأسئلة البرمجية والأكاديمية.\n` +
        `  2. تحليل أداء ودرجات المتعلم واقتراح خطط دراسية مخصصة.\n` +
        `  3. توليد بطاقات استذكار (Flashcards) وااختبارات سريعة (Quizzes).\n` +
        `  4. معالجة طلبات تعديل الدرجات وتحويل ملاحظات وشكاوى المتعلمين للمعلمين.\n` +
        `- **ما لا يستطيع فعله**: التعديل المباشر المعتمد لدرجات الكويزات دون موافقة المعلم، أو اتخاذ قرارات خارج النطاق التعليمي.\n` +
        `- **حد الرسائل (Message Limit)**: لا يوجد حد أقصى تعسفي للرسائل، ويتم ضبط السعة بناءً على ميزانية الخطة المحددة للمنصة.`;
    }
    // 2. Check for Exam / Test Preparation Questions
    else if (
      userQuery.includes("اختبار") ||
      userQuery.includes("امتحان") ||
      userQuery.includes("استعد") ||
      userQuery.includes("ذاكر") ||
      queryLower.includes("exam") ||
      queryLower.includes("test")
    ) {
      outputText = `### 🎯 دليل الاستعداد للاختبار القادم\n\n` +
        `مرحباً بك! للاستعداد بأفضل صورة للاختبار القادم، ننصحك باتباع الخطة التالية:\n\n` +
        `1. **راجع ملخصات الدروس الكودية**: ابدأ بالنقاط المفتاحية والشروحات الأساسية لكل موديول.\n` +
        `2. **حل الكويزات السابقة**: قُم بإعادة حل الأسئلة التي واجهت فيها صعوبة سابقاً لتثبيت المعلومة.\n` +
        `3. **التطبيق العملي**: اكتب الكود بنفسك وجربه لتتأكد من فهمك للآلية الداخلية للبرنامج.\n` +
        `4. **متابعة نقاط الضعف**: استعن ببطاقات الاستذكار السريع للمفاهيم التي تحتاج مراجعة إضافية.\n\n` +
        `*بالتوفيق والنجاح دائماً! نتمنى لك أعلى الدرجات.*`;
    }
    // 3. Check for Explicit Action Overrides (e.g. Action Buttons)
    else if (promptText.includes("[ACTION: SOLVE]") || promptText.includes("SOLVE")) {
      outputText = `### الحل التوضيحي بالخطوات\n\n` +
        `**الخطوة 1: تحليل المسألة**\nتحديد المعطيات والمطلوب بدقة.\n\n` +
        `**الخطوة 2: تطبيق الخوارزمية**\nنستخدم المعطيات للوصول إلى النتيجة الصحيحة.\n\n` +
        `**النتيجة النهائية**:\n\`\`\`javascript\n// النتيجة المعتمدة\nconst solution = true;\n\`\`\``;
    } else if (promptText.includes("[ACTION: QUIZ]") || promptText.includes("QUIZ")) {
      outputText = `### بطاقة الاختبار السريع\n\n` +
        `**سؤال**: ما هو الهدف الرئيسي من المتغيرات في البرمجة؟\n` +
        `- [x] أ) تخزين البيانات لاستخدامها لاحقاً\n` +
        `- [ ] ب) طباعة الصفحات\n` +
        `- [ ] ج) إغلاق المتصفح\n\n` +
        `*الإجابة الصحيحة*: أ`;
    } else if (promptText.includes("[ACTION: FLASHCARDS]") || promptText.includes("FLASHCARDS")) {
      outputText = `### بطاقات الاستذكار السريع (Flashcards)\n\n` +
        `| الوجه الأول (المفهوم) | الوجه الثاني (الشرح) |\n` +
        `| --- | --- |\n` +
        `| Variable | مكان في الذاكرة لتخزين قيمة قابلة للتغيير |\n` +
        `| Function | كتلة كود تنفذ مهمة محددة عند استدعائها |`;
    } else if (promptText.includes("[ACTION: SUMMARY]") || promptText.includes("SUMMARY")) {
      outputText = `### ملخص الدرس الأكاديمي\n\n` +
        `- **النقطة الأولى**: استعراض مفاهيم الدرس الأساسية وتحليل البنية النصية.\n` +
        `- **النقطة الثانية**: التطبيق العملي للأوامر البرمجية الهامة.\n` +
        `- **الملخص**: مراجعة دورية تضمن تثبيت المعلومات.`;
    } else if (promptText.includes("[ACTION: PLAN]") || promptText.includes("PLAN")) {
      outputText = `### خطة الدراسة الشخصية\n\n` +
        `1. **الجلسة الأولى (20 دقيقة)**: مشاهدة فيديو الدرس والتركيز على النقاط المفتاحية.\n` +
        `2. **الجلسة الثانية (15 دقيقة)**: حل الاختبارات والتمارين التفاعلية.\n` +
        `3. **الجلسة الثالثة (10 دقائق)**: مراجعة الملخص وبطاقات الذاكرة.`;
    } else if (promptText.includes("[ACTION: MOTIVATE]") || promptText.includes("MOTIVATE")) {
      outputText = `### تشجيع ودعم الطالب\n\n` +
        `أنت تسير في الطريق الصحيح للتميز الأكاديمي والبرمجي! التحديات اليوم هي مهارات الغد.\n` +
        `واصل الممارسة والتعلم خطوة بخطوة.`;
    } else if (promptText.includes("[ACTION: PARENT_REPORT]") || promptText.includes("PARENT_REPORT")) {
      outputText = `### تقرير ولي الأمر الدوري\n\n` +
        `نحيطكم علماً بأن الطالب يقدم أداءً ممتازاً في كورس البرمجة، حيث أتم نسبة كبيرة من الدروس والتسليمات.`;
    } else {
      outputText = `مرحباً بك! 👋\n\n` +
        `رداً على سؤالك: "${userQuery}"\n\n` +
        `أنا مرشدك التعليمي الذكي في منصة Code-UP. يسعدني مساعدتك في فهم المفاهيم البرمجية، حل التدريبات، وإعداد خطط الدراسة. كيف يمكنني مساعدتك أكثر اليوم؟`;
    }

    const outputTokens = this.estimateTokens(outputText);
    const latencyMs = Date.now() - startTime;

    return {
      text: outputText,
      providerId: this.id,
      providerName: this.name,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs,
      finishReason: "stop",
    };
  }

  public override async healthCheck(): Promise<boolean> {
    return true;
  }
}
