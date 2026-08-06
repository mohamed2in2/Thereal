import { StudentContext } from "./ai-context";

const PRIMARY_API_KEY = process.env.AI_PRIMARY_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || "";
const PRIMARY_API_URL = process.env.AI_PRIMARY_BASE_URL || "https://api.anthropic.com/v1/messages";
const PRIMARY_MODEL = process.env.AI_PRIMARY_MODEL || "claude-3-5-sonnet-20241022";

const BACKUP_API_KEY = process.env.AI_BACKUP_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const BACKUP_BASE_RAW = process.env.AI_BACKUP_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const BACKUP_BASE_URL = BACKUP_BASE_RAW.replace(/\/+$/, "");
const BACKUP_MODEL = process.env.AI_BACKUP_MODEL || "gemini-2.0-flash-lite";

export function stripFallbackMarkers(content: string): string {
  return content.replace(/\[م:[^\]]+\]/g, "").trim();
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIAction {
  type:
    | "create_grade_request"
    | "create_ticket"
    | "submit_feedback"
    | "navigate"
    | "show_insights"
    | "none";
  payload?: Record<string, unknown>;
}

export interface AIChatResult {
  message: string;
  actions: AIAction[];
  source: "primary" | "backup" | "fallback";
}

const SYSTEM_PROMPT = `أنت "مرشد Code-UP"، مساعد تدريبي ذكي يخدم المتعلمين المصريين على منصة Code-UP.

دورك:
- تتحدث مع المتعلم باللغة العربية المصرية الودودة
- لديك صلاحية كاملة لرؤية كل بيانات المتعلم: درجاته، تقدمه، كورساته، نقاط ضعفه، وملاحظاته
- تعرف المتعلم جيداً وتتحدث معه كمرشد شخصي يفهم وضعه
- أنت جزء من الموقع، لست مجرد بوت - تساعد المتعلم في استخدام كل الأدوات المتاحة

ما تقدر تعمله:
1. **خطة تدريبية مخصصة** - بناءً على نقاط ضعف المتعلم الحقيقية
2. **تحليل الأداء** - تشرح للمتعلم فين هو ضعيف وليه
3. **طلب تعديل درجة** - لو المتعلم أكد إن في إجابة صحيحة وحُسبت غلط، اعمل GradeAdjustmentRequest (المعلم هو اللي يوافق)
4. **استلام شكاوى** - لو المتعلم مش مرتاح من المعلم أو الكورس، سجلها كـ StudentFeedback
5. **خطة بديلة** - لو المتعلم بياخد الكورس مع حد تاني، اعمله خطة مختلفة بدون الفيديوهات اللي شافها برة
6. **توجيه** - وجّه المتعلم لصفحة الكورس أو المكتبة المناسبة
7. **تذكرة دعم** - لو فيه مشكلة فنية أو محتوى غلط، اعمل SupportTicket

قواعد مهمة جداً:
- **استجب مباشرة ووفقاً لسياق المتعلم** - تجنب القوالب الحرفية الثابتة أو العناوين التكرارية المعقدة.
- **تفاعل طبيعي ومرن** - إذا كان سؤال المتعلم استفساراً بسيطاً أو تحية، أجب باختصار ومباشرة.
- **لا تعدّل الدرجات مباشرة** - فقط أنشئ طلب تعديل وانتظر موافقة المعلم
- **لا تعتمد طلبات تعديل تافهة** - تأكد إن المتعلم فعلاً عنده سبب قوي (إجابة صحيحة لكن متسجلة غلط، أو سؤال غامض)
- **كن صادقاً** - لو المتعلم فعلاً ضعيف في موضوع، قوله بأدب، متجاملوش
- **استخدم بيانات المتعلم الديناميكية الحقيقية** المرفقة فقط.

الرد يجب أن يكون JSON بالشكل ده:
{
  "message": "ردك للمتعلم باللغة العربية",
  "actions": [
    {
      "type": "create_grade_request" | "create_ticket" | "submit_feedback" | "navigate" | "show_insights" | "none",
      "payload": { ... }
    }
  ]
}

أنواع الـ payload:
- create_grade_request: { quizId, reason, requestedScore, evidence }
- create_ticket: { title, description, type, priority }
- submit_feedback: { courseId, type, content, rating? }
- navigate: { path, reason }
- show_insights: {}`;

function summarizeContext(ctx: StudentContext): string {
  const courseLines = ctx.courses
    .map((c) => {
      const quizSummary = c.quizResults
        .filter((q) => q.date)
        .map((q) => `${q.quizTitle}: ${Math.round(q.percentage)}%`)
        .join(", ");
      return `- ${c.title} (${c.subject}, مدرس: ${c.teacher}): تقدم ${c.progress.percentage}% (${c.progress.videosWatched}/${c.progress.totalVideos} فيديو)${quizSummary ? `, كويزات: ${quizSummary}` : ""}`;
    })
    .join("\n");

  const weakAreasText = ctx.weakAreas.length > 0
    ? ctx.weakAreas.map((w) => `- ${w.subject}: ${w.topic} (${w.reason})`).join("\n")
    : "لا يوجد نقاط ضعف واضحة";

  const insightsText = ctx.aiInsights.length > 0
    ? ctx.aiInsights.map((i) => `- [${i.type}] ${i.title}: ${i.description}`).join("\n")
    : "لا يوجد رؤى سابقة";

  const feedbackText = ctx.recentFeedback.length > 0
    ? ctx.recentFeedback.map((f) => `- [${f.type}] في ${f.course}: ${f.content}`).join("\n")
    : "لم يقدم ملاحظات سابقة";

  return `بيانات المتعلم الكاملة:

الملف الشخصي:
- الاسم: ${ctx.profile.name}
- العمر: ${ctx.profile.age ?? "غير محدد"}
- المرحلة التدريبية: ${ctx.profile.educationalStage ?? "غير محددة"}

الإحصائيات العامة:
- عدد الكورسات: ${ctx.overallStats.totalCourses}
- متوسط الدرجات: ${ctx.overallStats.averageScore}%
- عدد الكويزات المحلولة: ${ctx.overallStats.totalQuizzesTaken}
- عدد الفيديوهات المشاهَدة: ${ctx.overallStats.totalVideosWatched}

الكورسات وتقدم المتعلم فيها:
${courseLines || "لم يسجل في كورسات بعد"}

نقاط الضعف الحالية:
${weakAreasText}

رؤى سابقة من الذكاء الاصطناعي:
${insightsText}

ملاحظات المتعلم الأخيرة:
${feedbackText}`;
}

async function callPrimary(messages: ChatMessage[]): Promise<AIChatResult | null> {
  if (!PRIMARY_API_KEY) return null;
  try {
    const sys = messages.find((m) => m.role === "system")?.content || "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const res = await fetch(PRIMARY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PRIMARY_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        max_tokens: 1200,
        temperature: 0.6,
        system: sys,
        messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Primary API: ${res.status}`);
    const data = (await res.json()) as { content: Array<{ text: string }> };
    const raw = data.content[0]?.text || "{}";
    // Find first JSON object in response
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return {
      message: String(parsed.message || raw),
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      source: "primary",
    };
  } catch (err) {
    console.error("Primary AI error:", err);
    return null;
  }
}

async function callBackup(messages: ChatMessage[]): Promise<AIChatResult | null> {
  if (!BACKUP_API_KEY) return null;
  try {
    const sys = messages.find((m) => m.role === "system")?.content || "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const promptText = sys
      ? `[النظام: ${sys}]\n\n` + userMsgs.map((m) => `${m.role === "user" ? "المتعلم" : "المرشد"}: ${m.content}`).join("\n")
      : userMsgs.map((m) => `${m.role === "user" ? "المتعلم" : "المرشد"}: ${m.content}`).join("\n");

    const geminiBase = BACKUP_BASE_URL.endsWith("/models") ? BACKUP_BASE_URL : `${BACKUP_BASE_URL}/models`;
    const url = `${geminiBase}/${BACKUP_MODEL}:generateContent?key=${BACKUP_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Backup AI (Gemini) ${res.status}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return {
      message: String(parsed.message || raw),
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      source: "backup",
    };
  } catch (err) {
    console.error("Backup AI (Gemini) error:", err);
    return null;
  }
}

// ── Menu state detection ──
function getMenuState(history: ChatMessage[]): { state: string; data: string } {
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return { state: "menu", data: "" };
  const match = lastAssistant.content.match(/\[م:([^:\]]+)(?::([^\]]*))?\]/);
  return match ? { state: match[1], data: match[2] || "" } : { state: "menu", data: "" };
}

function buildMainMenu(ctx: StudentContext, notifications?: string): string {
  let menu = "";
  if (notifications) {
    menu += `🔔 ${notifications}\n\n━━━━━━━━━━━━━━━━\n\n`;
  }
  menu += `اختار رقم:\n\n`;
  menu += `1️⃣  تحليل أدائي ودرجاتي\n`;
  menu += `2️⃣  خطة تدريبية\n`;
  menu += `3️⃣  طلب تعديل درجة ✏️\n`;
  menu += `4️⃣  تقديم شكوى 📢\n`;
  menu += `5️⃣  حالة طلباتي 📋\n\n`;
  menu += `📊 ${ctx.overallStats.totalCourses} كورس | متوسط ${ctx.overallStats.averageScore}%\n\n[م:menu]`;
  return menu;
}

function buildPerformanceAnalysis(ctx: StudentContext): string {
  const allQuizResults = ctx.courses.flatMap((c) => c.quizResults.filter((q) => q.date));
  const lowQuizzes = ctx.courses
    .flatMap((c) => c.quizResults.filter((q) => q.date && q.percentage < 60).map((q) => `• ${c.title} - ${q.quizTitle} (${Math.round(q.percentage)}%)`));
  const highQuizzes = ctx.courses
    .flatMap((c) => c.quizResults.filter((q) => q.date && q.percentage >= 80).map((q) => `• ${c.title} - ${q.quizTitle} (${Math.round(q.percentage)}%)`));

  let a = `📊 تحليل أدائك:\n\nمتوسط الدرجات: ${ctx.overallStats.averageScore}%\nكويزات محلولة: ${allQuizResults.length}\nفيديوهات متشافة: ${ctx.overallStats.totalVideosWatched}\n`;
  if (highQuizzes.length > 0) a += `\n💪 نقاط قوتك:\n${highQuizzes.slice(0, 3).join("\n")}\n`;
  if (lowQuizzes.length > 0) a += `\n⚠️ محتاج تراجع:\n${lowQuizzes.slice(0, 3).join("\n")}\n`;
  if (ctx.weakAreas.length > 0) a += `\n📌 نقاط ضعف:\n${ctx.weakAreas.slice(0, 3).map((w) => `• ${w.subject}: ${w.topic}`).join("\n")}\n`;
  if (lowQuizzes.length === 0 && ctx.weakAreas.length === 0) a += `\n✅ أداء ممتاز! مفيش نقاط ضعف.\n`;
  a += `\nاكتب 0 للرجوع\n\n[م:1]`;
  return a;
}

function buildStudyPlan(ctx: StudentContext): string {
  const weakSubjects = ctx.weakAreas.map((w) => w.subject).filter((v, i, a) => a.indexOf(v) === i);
  const coursesInfo = ctx.courses.map((c) => ({
    title: c.title, unwatched: c.progress.totalVideos - c.progress.videosWatched,
    lowQuizzes: c.quizResults.filter((q) => q.date && q.percentage < 60).length, progress: c.progress.percentage,
  }));
  const priority = coursesInfo.filter((c) => c.unwatched > 0 || c.lowQuizzes > 0);
  let plan = `📋 خطتك النهاردة:\n\n`;
  if (priority.length > 0) {
    plan += priority.slice(0, 3).map((c) => {
      const tasks: string[] = [];
      if (c.unwatched > 0) tasks.push(`شوف ${Math.min(c.unwatched, 2)} فيديو`);
      if (c.lowQuizzes > 0) tasks.push(`راجع الكويزات الضعيفة`);
      return `📚 ${c.title} (${c.progress}%):\n   ${tasks.join(" + ")}`;
    }).join("\n\n");
    if (weakSubjects.length > 0) plan += `\n\n⚠️ ركّز على: ${weakSubjects.join("، ")}`;
  } else {
    plan += `ممتاز! 🎉 خالص كل حاجة. راجع الكويزات اللي أقل من 80%.`;
  }
  plan += `\n\nاكتب 0 للرجوع\n\n[م:2]`;
  return plan;
}

function buildQuizList(ctx: StudentContext): { list: string; hasQuizzes: boolean } {
  const quizzes = ctx.courses.flatMap((c) =>
    c.quizResults.filter((q) => q.date).map((q) => ({
      code: q.quizId.slice(-8).toUpperCase(), title: q.quizTitle, course: c.title, score: Math.round(q.percentage),
    }))
  );
  if (quizzes.length === 0) return { list: "", hasQuizzes: false };
  return {
    list: quizzes.map((q) => `  ${q.code} → ${q.title} (${q.course}) - ${q.score}%`).join("\n"),
    hasQuizzes: true,
  };
}

function buildChatContextForStaff(history: ChatMessage[], ctx: StudentContext): { chatHistory: string; studentInfo: string } {
  const chatHistory = history.slice(-8).map((m) =>
    `${m.role === "user" ? "المتعلم" : "المرشد"}: ${m.content.replace(/\[م:[^\]]+\]/g, "").trim()}`
  ).join("\n");
  const studentInfo = [
    `الاسم: ${ctx.profile.name}`,
    `المرحلة: ${ctx.profile.educationalStage || "غير محدد"}`,
    `العمر: ${ctx.profile.age ?? "غير محدد"}`,
    `متوسط الدرجات: ${ctx.overallStats.averageScore}%`,
    `الكورسات: ${ctx.overallStats.totalCourses}`,
    `كويزات محلولة: ${ctx.overallStats.totalQuizzesTaken}`,
    `فيديوهات متشافة: ${ctx.overallStats.totalVideosWatched}`,
    ctx.weakAreas.length > 0 ? `نقاط ضعف: ${ctx.weakAreas.map((w) => `${w.subject}: ${w.topic}`).join("، ")}` : "",
  ].filter(Boolean).join("\n");
  return { chatHistory, studentInfo };
}

function fallbackResponse(
  userMessage: string,
  ctx: StudentContext,
  history: ChatMessage[],
  notifications?: string,
): AIChatResult {
  const input = userMessage.trim();
  const actions: AIAction[] = [];
  let message = "";

  const { state, data } = getMenuState(history);

  // ── Back to menu from any state ──
  if (input === "0" || input.includes("رجوع") || input.includes("القائمة")) {
    return { message: buildMainMenu(ctx, notifications), actions: [], source: "fallback" };
  }

  // ── State: Grade - Select Quiz (3a) ──
  if (state === "3a") {
    const code = input.toUpperCase().replace(/\s/g, "");
    const allQuizzes = ctx.courses.flatMap((c) =>
      c.quizResults.filter((q) => q.date).map((q) => ({
        quizId: q.quizId, quizTitle: q.quizTitle, courseTitle: c.title,
        code: q.quizId.slice(-8).toUpperCase(), percentage: q.percentage,
      }))
    );
    const selected = allQuizzes.find((q) => q.code === code || (code.length >= 4 && q.code.includes(code)));
    if (selected) {
      message = `✅ ${selected.quizTitle} (${selected.courseTitle})\nدرجتك: ${Math.round(selected.percentage)}%\n\n⬇️ اكتب سبب التعديل بالتفصيل:\n• رقم السؤال\n• إجابتك الصحيحة\n• ليه تفتكر إنها صح\n\n💡 مثال: "سؤال 2 إجابتي ب وهي الصح لأن..."\n\nاكتب 0 للرجوع\n\n[م:3b:${selected.quizId}]`;
    } else {
      message = `❌ كود غلط. اكتب الكود من القائمة (8 حروف).\n\nاكتب 0 للرجوع\n\n[م:3a]`;
    }
    return { message, actions, source: "fallback" };
  }

  // ── State: Grade - Write Reason (3b) ──
  if (state === "3b" && data) {
    if (input.length < 20) {
      message = `❌ السبب قصير (${input.length}/20 حرف). اكتب تفاصيل أكتر.\n\nاكتب 0 للرجوع\n\n[م:3b:${data}]`;
    } else {
      const staffCtx = buildChatContextForStaff(history, ctx);
      actions.push({
        type: "create_grade_request",
        payload: { quizId: data, reason: input, evidence: JSON.stringify(staffCtx) },
      });
      message = `✅ تم إرسال طلب تعديل الدرجة للمعلم!\n\n📋 السبب: ${input.slice(0, 80)}${input.length > 80 ? "..." : ""}\n\n⏳ المعلم هيراجع طلبك. اكتب 5 لمتابعة الحالة.\n\nاكتب 0 للرجوع\n\n[م:menu]`;
    }
    return { message, actions, source: "fallback" };
  }

  // ── Study plan intent — recognized in ANY state ──
  const isPlanMod = input.includes("بدل") || input.includes("بدلا") ||
    input.includes("اشوف") || input.includes("أشوف") ||
    (input.includes("غير") && (input.includes("فيديو") || input.includes("خطة") || input.includes("جدول"))) ||
    (input.includes("عايز") && (input.includes("فيديو") || input.includes("درس")));

  if (isPlanMod) {
    // Extract number from message if present
    const numMatch = input.match(/(\d+)/);
    const requestedCount = numMatch ? parseInt(numMatch[1]) : null;
    const plan = buildStudyPlan(ctx);
    const modNote = requestedCount !== null
      ? `\n\n💡 طيب — لو حابب تشوف ${requestedCount} بس يومياً ده شاطر! الخطة المعدّلة موجودة فوق. غير عدد الفيديوهات من صفحة الكورس.`
      : "\n\n💡 ممكن تعدّل الخطة بنفسك من صفحة الكورس — اختار عدد الفيديوهات اللي تقدر عليه.";
    message = plan.replace("\n\nاكتب 0 للرجوع", modNote + "\n\nاكتب 0 للرجوع");
    return { message, actions, source: "fallback" };
  }

  // ── State: Complaint - Write Details (4a) ──
  if (state === "4a") {
    if (input.length < 10) {
      message = `❌ اكتب تفاصيل أكتر (${input.length}/10 حرف).\n\nاكتب 0 للرجوع\n\n[م:4a]`;
    } else {
      const staffCtx = buildChatContextForStaff(history, ctx);
      const courseId = ctx.courses.length > 0 ? ctx.courses[0].id : undefined;
      actions.push({
        type: "create_ticket",
        payload: {
          title: `شكوى: ${input.slice(0, 50)}`,
          description: input,
          type: "complaint",
          priority: "normal",
          courseId,
          chatHistory: staffCtx.chatHistory,
          studentInfo: staffCtx.studentInfo,
        },
      });
      message = `✅ تم تسجيل شكواك!\n\n📋 ${input.slice(0, 80)}${input.length > 80 ? "..." : ""}\n\n⏳ هيتم مراجعتها. اكتب 5 لمتابعة الحالة.\n\nاكتب 0 للرجوع\n\n[م:menu]`;
    }
    return { message, actions, source: "fallback" };
  }

  // ── Rich intent detection (no AI needed) ────────────────────────────────
  const choice = input.replace(/[^\d]/g, "");
  const nm = ctx.profile.name?.split(" ")[0] ?? "صديقي";
  const i = input; // short alias

  // ── Intent flags ─────────────────────────────────────────────────────────

  const isPerf = choice === "1"
    || /أداء|اداء|حلل|تحليل|درج|قوت|قوة|علام|نتيج|نتيجة|تقييم|مجموع|score|grade|grades|result|results|performance|how.*am.*i|how.*doing|quiz result|my mark|marks/i.test(i);

  const isPlan = choice === "2"
    || /خطة|خطه|جدول|اذاكر|أذاكر|مراجعة|مراجعه|مراجع|النهارده|استعد|هذاكر|هبدأ|ابدأ|هادرس|ادرس|امتحان|فاين|plan|today|schedule|what.*study|study plan|what should i|what to do|what do i/i.test(i);

  const isEdit = choice === "3"
    || /تعديل.*درج|درج.*تعديل|grade.*fix|fix.*grade|wrong.*grade|grade.*wrong|درجة غلط|غلط.*درجة/i.test(i);

  const isComplaint = choice === "4"
    || /شكوى|شكوه|complaint|report/.test(i)
    || (i.includes("مشكل") && /مدرس|كورس|محتوى|سيء|غلط|خطأ/.test(i));

  const isStatus = choice === "5"
    || /حالة.*طلب|طلب.*حالة|status|my request|pending|check.*request|طلباتي/i.test(i);

  const isThankYou = /^(شكر|شكرا|شكراً|ممنون|يسلمو|مشكور|الله يخليك|يسعدك|جزاك|جزاكم|بارك الله|معك|تمام شكرا|okay thanks|ok thanks|thank|thanks|thx|ty|appreciate|ありがとう)/i.test(i)
    || /شكرا لك|شكراً لك|شكراً جداً|شكرا جدا|شكراً ع|ممتنن|امتنان|كتير شكر/i.test(i);

  const isTired = /تعبت|زهقت|مش قادر|مش قادرة|صعب|صعبة|مضغوط|مضغوطة|ضغط|مستحيل|مش هقدر|مش قادر أكمل|boring|tired|exhausted|stressed|too hard|give up|can't|cant|overwhelmed|fed up|hate studying/i.test(i);

  const isMotivation = /شجع|حافز|motivat|inspire|encourage|ادفعني|ذكرني|فكرني|اقولي حاجة|قولي حاجة تحمسني|تحفيز|زكرني/i.test(i);

  const isPositive = /برافو|عظيم|جامد|ممتاز|رائع|جميل|حلو|يا سلام|مبروك|great|amazing|wow|well done|good job|nice|perfect|excellent|awesome|super|fantastic|congrats|congratulations/i.test(i);

  const isMorning = /^(صباح|good morning|صبح الخير|صباح الخير|morning)/i.test(i);

  const isEvening = /^(مساء|مساء الخير|good evening|good night|ليلة سعيدة|تصبح على خير|evening|night)/i.test(i);

  const isIslamicGreeting = /^(السلام عليكم|وعليكم السلام|سلام عليكم|السلام)/i.test(i);

  const isGreeting = isMorning || isEvening || isIslamicGreeting
    || /^(مرحبا|مرحباً|أهلا|أهلاً|اهلا|هاي|هلو|هالو|ازيك|عامل|كيفك|كيف حالك|hi|hello|hey|yo|sup|howdy|what.?s up|wassup|hola|greetings)/i.test(i);

  const isQuestion = /\?|؟|ايه|إيه|ما هو|ما هي|كيف|ليه|why|how|what|when|where|من|who|هل|is it|can you|do you/i.test(i)
    && !isPerf && !isPlan && !isEdit && !isComplaint && !isStatus;

  const isCourseNav = /فين الكورس|فين درس|روح.*كورس|مكتبة|library|my courses|where.*course|كورساتي|دروسي/i.test(i);

  const isBye = /^(bye|goodbye|see you|later|مع السلامة|وداعا|وداعاً|يلا|يلا باي|سلامة|تسلم|ماشي|okay goodbye|ok bye)/i.test(i);

  const isYes = /^(تمام|ايوه|اه|نعم|اوك|اوكي|yes|yeah|yep|ok|okay|sure|alright|بالظبط|صح|كويس|ماشي|yup|yap)$/i.test(i.trim());

  const isNo = /^(لا|نو|no|nope|nah|أبداً|ابدا)$/i.test(i.trim());

  const isLove = /بحبك|أحبك|love you|i love|you are the best|أنت الأفضل|الأحسن|أحسن|تبقى كويس/i.test(i);

  const isAboutBot = /مين أنت|من أنت|who are you|what are you|بتعمل ايه|بتعمل إيه|ايه دورك|إيه دورك|عنك|عن نفسك|تعرف.*نفسك|about you/i.test(i);

  const isHelp = !isPerf && !isPlan && !isEdit && !isComplaint && !isStatus
    && (/ساعد|مساعدة|help|assist|support|محتاج|محتاجة|ممكن|قدرني|عايز حاجة|أريد|ابدأ|start/i.test(i) || isGreeting || isMorning || isEvening);

  // ── Pick response ─────────────────────────────────────────────────────────

  const isCoding = /coding|كود|برمجة|تكويد|برمجيات|برنامج|python|javascript|c\+\+|html|css|java|react|node/i.test(i);

  if (isBye) {
    const byes = [
      `مع السلامة يا ${nm}! 👋 وفقك الله في مذاكرتك. 🌟`,
      `يلا سلامة يا ${nm}! 😊 اتذكر — كل يوم بتذاكر فيه ده استثمار في مستقبلك. 🎯`,
      `وداعاً يا ${nm}! 🌙 لو محتاجني رجعلي في أي وقت. 💙`,
    ];
    message = byes[Math.floor(Date.now() / 1000) % byes.length];

  } else if (isCoding) {
    message = `البرمجة (Coding) هي كتابة تعليمات وأوامر يفهمها الكمبيوتر لبناء مواقع، تطبيقات، وألعاب! 💻🚀\n\nتعتمد البرمجة على حل المشكلات والتفكير المنطقي خطوة بخطوة بلغات مثل JavaScript و Python.\n\nعلى منصة Code-UP بنساعدك تطبق عملي من خلال الكورسات والتطبيقات التفاعلية! 🌟\n\nعايز تبدأ المذاكرة معنا؟ اكتب **2** لخطة التدريب! 📚`;

  } else if (isThankYou) {
    const thanks = [
      `يسعدني خدمتك يا ${nm}! 😊 لو محتاج أي حاجة تاني، أنا هنا دايماً.`,
      `وإياك! 🤝 ده واجبي. لو عندك أي سؤال قولي.`,
      `الشكر لله! 😊 وفقك الله في مذاكرتك يا ${nm}. 🌟`,
      `يسعدك يا ${nm}! 💙 متنساش تذاكر النهارده.`,
    ];
    message = thanks[Math.floor(Date.now() / 1000) % thanks.length];

  } else if (isLove) {
    message = `وأنا أكثر! 😄💙 أنا هنا عشانك يا ${nm}. تعالى نذاكر؟\n\nاكتب 2 وأنا هجيبلك خطتك.`;

  } else if (isAboutBot) {
    message = `أنا مرشد Code-UP الذكي! 🤖\n\n` +
      `دوري أساعدك في:\n` +
      `• 📊 تحليل أدائك ودرجاتك\n` +
      `• 📋 خطة مذاكرة مخصصة ليك\n` +
      `• ✏️ طلبات تعديل الدرجات\n` +
      `• 📢 تسجيل شكاوى للمعلم\n` +
      `• 📋 متابعة طلباتك\n\n` +
      `بشتغل 24/7 بدون تعب! 😄 إيه اللي محتاجه؟`;

  } else if (isTired) {
    const motivation = [
      `يا ${nm}، كل الناجحين مروا بنفس الإحساس ده بالظبط! 💪\n\n"الصبر مفتاح الفرج" — خد راحة 10 دقايق وارجع أقوى. 🔥\n\nلما ترجع اكتب 2 وهجهزلك خطة خفيفة. ✨`,
      `طبيعي جداً تحس بالتعب يا ${nm}! 😊\n\n"الأبطال مش اللي مش بيتعبوا، هم اللي بيكملوا وإنهم تعبانين!" 🏆\n\nشيل شيء صغير النهارده — اكتب 2 وهساعدك.`,
      `زهقت يعني؟ 😄 ده معناه إنك بتشتغل! 💪\n\nغير المكان، اعمل كوباية شاي، وارجع. المذاكرة مش سباق — هي رحلة. 🌟\n\nاكتب 1 تشوف إيه اللي وصلت له لحد دلوقتي.`,
    ];
    message = motivation[Math.floor(Date.now() / 1000) % motivation.length];

  } else if (isMotivation) {
    const motivations = [
      `يا ${nm}، النجاح مش بالموهبة — بالمثابرة! 🔥\n\n"كل يوم بتذاكر فيه بيفرق." — ابدأ بخطوة واحدة صغيرة.\n\nاكتب 2 وأنا هجيبلك خطة النهارده. 💪`,
      `تحفيز يا ${nm}؟ هاهو: 🚀\n\n${ctx.overallStats.totalQuizzesTaken > 0 ? `عملت ${ctx.overallStats.totalQuizzesTaken} كويز! ده إنجاز حقيقي.` : `كل بداية لها نهاية. ابدأ دلوقتي وأنت هتفرق!`}\n\n"الاستمرار هو المفتاح." اكتب 2 لخطتك. ✨`,
      `يا ${nm}, remember this: كل دقيقة بتذاكرها دلوقتي هتفرق في مستقبلك. 💡\n\nما تتأخرش — اكتب 2 وابدأ النهارده! 🎯`,
    ];
    message = motivations[Math.floor(Date.now() / 1000) % motivations.length];

  } else if (isPositive) {
    const cheers = [
      `شكراً يا ${nm}! 🙏 كلامك الحلو بيحمسنا! 🔥 استمر على المستوى ده.`,
      `يا سلام! 😊 وأنت أجمد يا ${nm}! كمل كده وهتوصل لأي هدف. 💪`,
      `وأنت كمان عظيم يا ${nm}! 🌟 إيه اللي ممكن أساعدك فيه دلوقتي؟`,
    ];
    message = cheers[Math.floor(Date.now() / 1000) % cheers.length];

  } else if (isMorning) {
    message = `صباح النور يا ${nm}! ☀️\n\nيوم جديد = فرصة جديدة! 📚\n\nعايز تبدأ يومك صح؟ اكتب **2** وأنا هجيبلك خطة النهارده. 🎯`;

  } else if (isEvening) {
    const evn = new Date().getHours() < 20
      ? `مساء النور يا ${nm}! 🌅 عندك وقت للمذاكرة؟ اكتب **2** لخطة المساء.`
      : `مساء النور يا ${nm}! 🌙 تصبح على خير. لو عندك وقت صغير — اكتب 2 لمراجعة سريعة. ✨`;
    message = evn;

  } else if (isIslamicGreeting) {
    message = i.toLowerCase().startsWith("وع") || i.includes("وعليكم")
      ? `وعليكم السلام ورحمة الله وبركاته يا ${nm}! 😊\n\nكيف أقدر أساعدك النهارده؟\n\n` + buildMainMenu(ctx).replace("اختار رقم:\n\n", "اختار:\n")
      : `وعليكم السلام ورحمة الله يا ${nm}! 😊\n\nإيه اللي محتاجه النهارده؟\n\n` + buildMainMenu(ctx).replace("اختار رقم:\n\n", "اختار:\n");

  } else if (isYes) {
    message = `تمام يا ${nm}! 😊 قولي إيه اللي محتاجه:\n\n` + buildMainMenu(ctx).replace("اختار رقم:\n\n", "");

  } else if (isNo) {
    message = `خير يا ${nm}! 😊 قولي إيه اللي في بالك وأنا هساعدك. ✨`;

  } else if (isCourseNav) {
    message = `📚 كورساتك موجودة في **مكتبتي** من القائمة فوق.\n\nعندك الآن ${ctx.courses.length} كورس${ctx.courses.length > 0 ? ":\n" + ctx.courses.map(c => `• ${c.title}`).join("\n") : " مسجّل."}\n\nعايز خطة مذاكرة؟ اكتب **2** ⬇️\n\n[م:menu]`;

  } else if (isPerf) {
    message = buildPerformanceAnalysis(ctx);

  } else if (isPlan) {
    message = buildStudyPlan(ctx);

  } else if (isEdit) {
    const { list, hasQuizzes } = buildQuizList(ctx);
    if (hasQuizzes) {
      message = `✏️ طلب تعديل درجة\n\nكويزاتك:\n${list}\n\n⬇️ اكتب كود الكويز:\n\nاكتب 0 للرجوع\n\n[م:3a]`;
    } else {
      message = `مفيش كويزات محلولة لسه.\n\n${buildMainMenu(ctx)}`;
    }

  } else if (isComplaint) {
    const courseList = ctx.courses.length > 0
      ? ctx.courses.map((c) => `• ${c.title} (${c.subject})`).join("\n") + "\n\n"
      : "";
    message = `📢 تقديم شكوى\n\n${courseList}⬇️ اكتب تفاصيل شكواك أو المشكلة:\n\nاكتب 0 للرجوع\n\n[م:4a]`;

  } else if (isStatus) {
    actions.push({ type: "show_insights", payload: { checkStatus: true } });
    message = `📋 جاري تحميل حالة طلباتك...\n\n[م:5]`;

  } else if (isQuestion) {
    message = `سؤالك وصلني يا ${nm}! 🤔\n\nأنا مساعدك في الكورسات والدراسة على Code-UP. اختار اللي محتاجه:\n\n` + buildMainMenu(ctx).replace("اختار رقم:\n\n", "");

  } else if (isHelp) {
    message = `أهلاً يا ${nm}! 😊 أنا مرشدك الذكي على Code-UP.\n\nممكن أساعدك في:\n• تحليل أداءك ودرجاتك 📊\n• خطة مذاكرة مخصصة 📋\n• طلب تعديل درجة ✏️\n• تسجيل شكوى 📢\n\nقولي إيه اللي محتاجه! 💪\n\n` + buildMainMenu(ctx).replace("اختار رقم:\n\n", "أو اختار:\n");

  } else {
    message = buildMainMenu(ctx, notifications);
  }

  return { message, actions, source: "fallback" };
}

export async function chatWithAI(
  userMessage: string,
  history: ChatMessage[],
  studentContext: StudentContext,
  notifications?: string,
): Promise<AIChatResult> {
  const contextSummary = summarizeContext(studentContext);
  const cleanHistory = history.slice(-10).map((m) => ({
    role: m.role,
    content: stripFallbackMarkers(m.content),
  })).filter((m) => m.content.length > 0);
  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextSummary}` },
    ...cleanHistory,
    { role: "user", content: userMessage },
  ];

  // 1. Try Gemini first
  let result = await callBackup(messages);
  if (result && result.message) {
    result.message = stripFallbackMarkers(result.message);
    return result;
  }

  // 2. Try Primary / DeepSeek
  result = await callPrimary(messages);
  if (result && result.message) {
    result.message = stripFallbackMarkers(result.message);
    return result;
  }

  // 3. Smart menu fallback (always runs when no AI key configured)
  const fb = fallbackResponse(userMessage, studentContext, history, notifications);
  fb.message = stripFallbackMarkers(fb.message);
  return fb;
}

export async function analyzeQuizAnswer(
  question: string,
  studentAnswer: string,
  correctAnswer: string,
  options: Record<string, string>
): Promise<{ wasMisgraded: boolean; reasoning: string; confidence: number }> {
  const prompt = `حلل سؤال الكويز ده:

السؤال: ${question}
خيارات: ${JSON.stringify(options, null, 2)}
إجابة المتعلم: ${studentAnswer}
الإجابة المعتمدة: ${correctAnswer}

هل إجابة المتعلم فعلاً غلط؟ أو ممكن تكون صحيحة من ناحية أخرى؟ ممكن السؤال يكون غامض؟

رد بـ JSON:
{
  "wasMisgraded": boolean,
  "reasoning": "سبب القرار بالعربي",
  "confidence": 0-1
}`;

  const messages: ChatMessage[] = [
    { role: "system", content: "أنت مدرس خبير تحلل أسئلة الكويزات بدقة. ترد بـ JSON فقط." },
    { role: "user", content: prompt },
  ];

  const result = await callPrimary(messages);
  if (result?.message) {
    try {
      const match = result.message.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (parsed) {
        return {
          wasMisgraded: !!parsed.wasMisgraded,
          reasoning: String(parsed.reasoning || ""),
          confidence: Number(parsed.confidence || 0.5),
        };
      }
    } catch {
      // Fall through
    }
  }

  return {
    wasMisgraded: false,
    reasoning: "لم نتمكن من تحليل السؤال تلقائياً، يرجى مراجعة المعلم",
    confidence: 0,
  };
}

export async function generateInsights(
  studentContext: StudentContext
): Promise<Array<{ type: string; category: string; title: string; description: string; confidence: number }>> {
  const ctx = summarizeContext(studentContext);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "أنت محلل تدريبي. حلل بيانات المتعلم واستخرج 3-5 رؤى مهمة (نقاط قوة، نقاط ضعف، توصيات، تحذيرات). رد بـ JSON.",
    },
    {
      role: "user",
      content: `${ctx}\n\nأعطني JSON:\n{ "insights": [{ "type": "weak_area"|"strength"|"recommendation"|"risk_alert", "category": "math"|"physics"|...|"general", "title": "عنوان قصير", "description": "وصف مفصل", "confidence": 0-1 }] }`,
    },
  ];

  const result = await callPrimary(messages);
  if (result?.message) {
    try {
      const match = result.message.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (parsed?.insights && Array.isArray(parsed.insights)) {
        return parsed.insights;
      }
    } catch {
      // Fall through
    }
  }

  // Generate from context
  const insights: Array<{ type: string; category: string; title: string; description: string; confidence: number }> = [];
  for (const weak of studentContext.weakAreas.slice(0, 3)) {
    insights.push({
      type: "weak_area",
      category: weak.subject,
      title: `ضعف في ${weak.topic}`,
      description: `${weak.reason}. ${weak.evidence}`,
      confidence: 0.8,
    });
  }
  if (studentContext.overallStats.averageScore >= 80) {
    insights.push({
      type: "strength",
      category: "general",
      title: "أداء متميز",
      description: `متوسطك ${studentContext.overallStats.averageScore}% - استمر!`,
      confidence: 0.9,
    });
  }
  return insights;
}
