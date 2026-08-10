import { NextRequest, NextResponse } from "next/server";
import { getStudentSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStudentContext } from "@/lib/ai-context";
import { chatWithAI, type ChatMessage, type AIAction } from "@/lib/ai-assistant";

export async function POST(req: NextRequest) {
  try {
    // Accept students AND admins/owners (they need to test the chat too)
    const session = await getStudentSession() ?? await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
    }

    const trimmedMsg = message.trim();
    const cleanMsg = trimmedMsg.toLowerCase();
    const isAdmin = session.role === "admin" || session.role === "superadmin" || session.isOwner === true;

    // ── STRICT ADMIN-ONLY CHEAT CODES & DEVELOPER TOOLS ──────────────────────
    if (isAdmin) {
      // Check if the previous message in conversation history was the developer menu
      const lastAssistantMsg = await prisma.aIConversation.findFirst({
        where: { studentId: session.id, role: "assistant" },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }).catch(() => null);
      const isAfterDevMenu = lastAssistantMsg?.content?.includes("[م:dev_menu]") || lastAssistantMsg?.content?.includes("Secret AI Model Switcher");

      // 1. Ahmed123M / Admin123 / stats command check for live AI statistics & model telemetry (ADMIN ONLY)
      if (cleanMsg === "ahmed123m" || cleanMsg === "admin123" || cleanMsg === "stats") {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayConversations = await prisma.aIConversation.findMany({
          where: { createdAt: { gte: startOfToday } },
          select: { studentId: true },
        });
        const uniqueUsersToday = new Set(todayConversations.map((c) => c.studentId)).size;
        const totalMessagesToday = todayConversations.length;

        const { CostManager } = await import("@/ai/admin/cost_analytics/CostManager");
        const { Telemetry } = await import("@/ai/telemetry/Telemetry");
        const { ConfigManager } = await import("@/ai/config/AIConfig");

        const costMgr = CostManager.getInstance();
        const telemetry = Telemetry.getInstance();
        const config = ConfigManager.getInstance().getConfig();

        const metrics = telemetry.getMetrics();
        const providerCosts = costMgr.getCostByProvider();
        const totalCostUsd = costMgr.getTotalCostUsd();

        let activeModel = config.primaryProvider;
        if (config.primaryProvider === "digitalocean") {
          activeModel = "Code-UP Platform Assistant (DigitalOcean Premium)";
        } else if (config.primaryProvider === "gemini") {
          activeModel = "Google Gemini Pool (Primary)";
        } else if (config.primaryProvider === "deepseek" || config.primaryProvider === "deepseek_v4_flash") {
          activeModel = "DeepSeek V4 Flash";
        }

        const geminiRequests = metrics.requestsByProvider["gemini"] || 0;
        const geminiCost = providerCosts["gemini"] || 0;

        const doRequests = metrics.requestsByProvider["digitalocean"] || 0;
        const doCost = providerCosts["digitalocean"] || 0;

        const deepseekRequests = (metrics.requestsByProvider["deepseek_v4_flash"] || 0) + (metrics.requestsByProvider["deepseek"] || 0);
        const deepseekCost = (providerCosts["deepseek_v4_flash"] || 0) + (providerCosts["deepseek"] || 0);

        const mockRequests = metrics.requestsByProvider["mock"] || 0;

        const statsText = `📊 **تقرير الإحصائيات الفوري للنظام (Ahmed123M Live Stats)**\n\n` +
          `🤖 **النموذج المتحدث الحالي (Talking Model)**: \`${activeModel}\`\n` +
          `🔄 **سلسلة التراجع التلقائي (Fallback Chain)**: \`DigitalOcean ➔ Gemini Pool ➔ Mock ➔ DeepSeek V4 Flash\`\n` +
          `👥 **عدد مستخدمي الذكاء الاصطناعي اليوم (Users Today)**: ${uniqueUsersToday} مستخدم\n` +
          `💬 **إجمالي رسائل المحادثة اليوم (Messages Today)**: ${totalMessagesToday} رسالة\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `💸 **تكاليف واستخدام المزودين (Today's Provider Costs & Usage)**:\n` +
          `• 💰 **إجمالي التكلفة اليومية الكلية**: \`$${totalCostUsd.toFixed(6)} USD\`\n` +
          `• ⚡ **DigitalOcean Premium**: ${doRequests} طلبات | تكلفة: \`$${doCost.toFixed(6)} USD\`\n` +
          `• 🟢 **Google Gemini Pool**: ${geminiRequests} طلبات | تكلفة: \`$${geminiCost.toFixed(6)} USD\`\n` +
          `• 🟡 **Mock Provider (Local)**: ${mockRequests} طلبات | تكلفة: \`$0.00 USD\` (مجاني محلي)\n` +
          `• 🔵 **DeepSeek V4 Flash**: ${deepseekRequests} طلبات | تكلفة: \`$${deepseekCost.toFixed(6)} USD\` (احتياطي دائم)\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `🛡️ **حالة الميزانية والأمان (Budget & Safety Limits)**:\n` +
          `• 📊 **الاستهلاك مقابل الميزانية**: \`$${totalCostUsd.toFixed(4)} / $50.00 Max USD\`\n` +
          `• ⚡ **إجمالي التوكنز المستهلكة**: ${metrics.totalTokensUsed} tokens\n` +
          `• ⏳ **متوسط سرعة الاستجابة**: ${Math.round(metrics.averageLatencyMs)} ms\n` +
          `• ⚙️ **حد حفظ المحادثة الأقصى**: 15 رسالة فقط`;

        return NextResponse.json({
          message: statsText,
          actions: [],
          source: "admin_stats",
        });
      }

      // 2. Secret password to unlock Developer Mode & Model Switcher: AhmedToldMeSotalkelse (ADMIN ONLY)
      const isDevSecretTrigger = cleanMsg.includes("ahmedtoldmesotalkelse") || cleanMsg === "dev" || cleanMsg === "developer";
      const isModelSwitchFollowUp = isAfterDevMenu && ["1", "2", "3", "4", "do", "gemini", "deepseek", "mock", "digitalocean"].includes(cleanMsg);

      if (isDevSecretTrigger || isModelSwitchFollowUp) {
        const { ConfigManager } = await import("@/ai/config/AIConfig");
        const configMgr = ConfigManager.getInstance();

        let arg = cleanMsg.replace("ahmedtoldmesotalkelse", "").replace("developer", "").replace("dev", "").trim();
        if (isModelSwitchFollowUp) arg = cleanMsg;

        if (arg === "1" || arg === "do" || arg === "digitalocean" || arg === "codeup") {
          configMgr.updateConfig({ primaryProvider: "digitalocean" });
          const switchText = `👨‍💻 **تم تفعيل وضع المطور + تحويل النموذج إلى 1!**\n\n` +
            `🤖 **النموذج المتحدث**: \`Code-UP Platform Assistant (DigitalOcean Premium Llama-3.3-70B)\`\n` +
            `⚡ **وضع المطور**: لن يتم التعامل معك كطالب، ولن يكون هناك أي شرح أو تعليم غير مطلوب. استجابات سريعة ومباشرة للمطور.`;
          return NextResponse.json({
            message: switchText,
            actions: [],
            source: "developer_mode",
          });
        } else if (arg === "2" || arg === "gemini") {
          configMgr.updateConfig({ primaryProvider: "gemini" });
          return NextResponse.json({
            message: "👨‍💻 **تم تفعيل وضع المطور + تحويل النموذج إلى Google Gemini Pool (Primary)**",
            actions: [],
            source: "developer_mode",
          });
        } else if (arg === "3" || arg === "deepseek") {
          configMgr.updateConfig({ primaryProvider: "deepseek" });
          return NextResponse.json({
            message: "👨‍💻 **تم تفعيل وضع المطور + تحويل النموذج إلى DeepSeek V4 Flash**",
            actions: [],
            source: "developer_mode",
          });
        } else if (arg === "4" || arg === "mock") {
          configMgr.updateConfig({ primaryProvider: "mock" });
          return NextResponse.json({
            message: "👨‍💻 **تم تفعيل وضع المطور + تحويل النموذج إلى Mock Provider (Local Test)**",
            actions: [],
            source: "developer_mode",
          });
        } else {
          const menuText = `👨‍💻 **تم تفعيل وضع المطور المباشر (Developer / Admin Mode Activated)**\n\n` +
            `أهلاً يا باشمهندس! تم تحويل النظام للتعامل معك كـ **Platform Developer** وليس كطالب:\n` +
            `• ❌ إلغاء الشرح والتعليم التلقائي غير المطلوب\n` +
            `• ⚡ استجابة فورية ومباشرة للأوامر البرمجية والمنصة\n` +
            `• 🗑️ مسح المحادثات السابقة عند الحاجة بكلمة \`AhmedReset\`\n\n` +
            `🤖 **اختيار النموذج بـ 1-4 (Secret AI Model Switcher)**:\n` +
            `1️⃣ **DigitalOcean Premium Model** (Llama-3.3-70B)\n` +
            `2️⃣ **Google Gemini Pool** (Primary)\n` +
            `3️⃣ **DeepSeek V4 Flash** (Fast Backup)\n` +
            `4️⃣ **Mock Provider** (Local Test)\n\n` +
            `💡 *للتحويل المباشر اكتب الرقم:* \`1\` أو \`2\` أو \`3\` أو \`4\`\n\n[م:dev_menu]`;
          return NextResponse.json({
            message: menuText,
            actions: [],
            source: "developer_mode",
          });
        }
      }

      // 3. Secret password for Professional Mode: AhmedProMode / professional / pro (ADMIN ONLY)
      if (cleanMsg === "ahmedpromode" || cleanMsg === "professional" || cleanMsg === "pro") {
        return NextResponse.json({
          message: "👔 **تم تفعيل الوضع المهني المتقدم (Professional Mode)**\n\nسيتحدث الوكيل بأسلوب عملي، رسمي، ومباشر دون مقدمات إضافية.\n\n[م:pro_mode]",
          actions: [],
          source: "pro_mode",
        });
      }

      // 4. Secret password for Fast Response Mode: AhmedFastMode / fast / speed (ADMIN ONLY)
      if (cleanMsg === "ahmedfastmode" || cleanMsg === "fast" || cleanMsg === "speed") {
        return NextResponse.json({
          message: "⚡ **تم تفعيل وضع الاستجابة الفائقة (Fast Latency Mode)**\n\nإجابات موجزة في نقاط سريعة بأقل زحام في الكلمات.\n\n[م:fast_mode]",
          actions: [],
          source: "fast_mode",
        });
      }
    }

    // ── Command to purge/delete own chat history (Available for any user) ─────
    if (cleanMsg === "ahmedreset" || cleanMsg === "clear" || cleanMsg === "delete") {
      await prisma.aIConversation.deleteMany({
        where: { studentId: session.id },
      });
      const { MemoryManager } = await import("@/ai/memory/MemoryManager");
      MemoryManager.getInstance().clearSession(session.id);

      return NextResponse.json({
        message: "🗑️ **تم مسح جميع الرسائل والمحادثات السابقة والحالية بنجاح!**\n\nتم إعادة ضبط السجل بالكامل.",
        actions: [],
        source: "chat_cleared",
      });
    }

    // Build full student context
    let context;
    try {
      context = await buildStudentContext(session.id);
    } catch (ctxErr) {
      console.error("[chat/route] buildStudentContext failed:", ctxErr);
      context = {
        profile: {
          id: session.id,
          name: session.name || "الطالب",
          email: session.email || "",
          age: null,
          educationalStage: null,
          phone: null,
        },
        courses: [],
        overallStats: { totalCourses: 0, averageScore: 0, totalQuizzesTaken: 0, totalVideosWatched: 0 },
        weakAreas: [],
        aiInsights: [],
        recentFeedback: [],
        libraryProgress: [],
      };
    }

    // Get conversation history (last 15 messages)
    const history = await prisma.aIConversation.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, role: true, content: true },
    }).catch(() => []);

    const chatHistory: ChatMessage[] = history
      .reverse()
      .map((h) => ({
        role: h.role as ChatMessage["role"],
        content: h.content,
      }));

    // Build notifications from recently resolved requests
    const notifItems: string[] = [];
    try {
      const recentGrades = await prisma.gradeAdjustmentRequest.findMany({
        where: { studentId: session.id, status: { in: ["approved", "rejected"] }, reviewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        include: { quiz: { select: { title: true } } },
        orderBy: { reviewedAt: "desc" },
        take: 3,
      });
      const recentTickets = await prisma.supportTicket.findMany({
        where: { studentId: session.id, status: { in: ["resolved", "closed"] }, updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      });
      for (const r of recentGrades) {
        notifItems.push(`تعديل درجة "${r.quiz.title}": ${r.status === "approved" ? "مقبول ✅" : "مرفوض ❌"}${r.teacherNotes ? ` - ${r.teacherNotes}` : ""}`);
      }
      for (const t of recentTickets) {
        notifItems.push(`"${t.title}": ${t.status === "resolved" ? "تم الحل ✅" : "مغلق"}${t.resolution ? ` - ${t.resolution}` : ""}`);
      }
    } catch { /* ignore notification errors */ }

    const notifications = notifItems.length > 0 ? `تحديثات طلباتك:\n${notifItems.map((n) => `• ${n}`).join("\n")}` : undefined;

    // Save user message
    try {
      await prisma.aIConversation.create({
        data: {
          studentId: session.id,
          role: "user",
          content: message,
        },
      });
    } catch { /* ignore save failure */ }

    // Get AI response — try chatWithAI first (runs Gemini -> Anthropic/DeepSeek -> smart fallbackResponse)
    let result;
    try {
      result = await chatWithAI(message, chatHistory, context, notifications);
    } catch (chatErr) {
      console.error("[chat/route] chatWithAI threw, falling back to AIEngine:", chatErr);
      try {
        const { AIEngine } = await import("@/ai/AIEngine");
        const engine = new AIEngine();
        const engineRes = await engine.processRequest({
          userMessage: message,
          studentId: session.id,
          subject: context?.courses?.[0]?.subject || "عام",
          grade: "3",
        });
        const resText = engineRes?.formattedResponse?.renderedContent || engineRes?.formattedResponse?.rawContent;
        if (engineRes && engineRes.success && resText) {
          result = {
            message: resText,
            actions: [] as AIAction[],
            source: (engineRes.telemetry?.provider || "primary") as "primary" | "backup" | "fallback",
          };
        } else {
          result = {
            message: "أهلاً بيك! أنا مرشدك الذكي 🌟 قولي إيه اللي محتاجه وسيتم مساعدتك فوراً!",
            actions: [] as AIAction[],
            source: "fallback" as const,
          };
        }
      } catch {
        result = {
          message: "أهلاً بيك! أنا مرشدك الذكي 🌟 قولي إيه اللي محتاجه وسيتم مساعدتك فوراً!",
          actions: [] as AIAction[],
          source: "fallback" as const,
        };
      }
    }

    // Execute AI actions if any
    const executedActions: Array<{ type: string; status: string; id?: string; error?: string }> = [];
    for (const action of result.actions) {
      // Handle status check inline (option 5)
      if (action.type === "show_insights" && (action.payload as Record<string, unknown>)?.checkStatus) {
        const gradeReqs = await prisma.gradeAdjustmentRequest.findMany({
          where: { studentId: session.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { quiz: { select: { title: true } } },
        });
        const ticketReqs = await prisma.supportTicket.findMany({
          where: { studentId: session.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        let statusMsg = "📋 حالة طلباتي:\n\n";
        if (gradeReqs.length === 0 && ticketReqs.length === 0) {
          statusMsg += "مفيش طلبات لسه.\n";
        } else {
          if (gradeReqs.length > 0) {
            statusMsg += "✏️ طلبات تعديل درجة:\n";
            for (const r of gradeReqs) {
              const lbl = r.status === "approved" ? "مقبول ✅" : r.status === "rejected" ? "مرفوض ❌" : "قيد المراجعة ⏳";
              statusMsg += `• ${r.quiz.title}: ${lbl}${r.teacherNotes ? ` (${r.teacherNotes})` : ""}\n`;
            }
            statusMsg += "\n";
          }
          if (ticketReqs.length > 0) {
            statusMsg += "📢 الشكاوى:\n";
            for (const t of ticketReqs) {
              const lbl = t.status === "resolved" ? "تم الحل ✅" : t.status === "closed" ? "مغلق" : t.status === "escalated" ? "تم التصعيد ↑" : "مفتوح ⏳";
              statusMsg += `• ${t.title}: ${lbl}${t.resolution ? ` (${t.resolution})` : ""}\n`;
            }
          }
        }
        statusMsg += "\nاكتب 0 للرجوع\n\n[م:5]";
        result.message = statusMsg;
        executedActions.push({ type: "show_insights", status: "ok" });
        continue;
      }
      const exec = await executeAction(session.id, action);
      executedActions.push(exec);
    }

    // Save assistant response with actions
    await prisma.aIConversation.create({
      data: {
        studentId: session.id,
        role: "assistant",
        content: result.message,
        actions: executedActions.length > 0 ? JSON.stringify(executedActions) : null,
        context: JSON.stringify({
          source: result.source,
          courses: context.courses.length,
          weakAreas: context.weakAreas.length,
        }),
      },
    });

    // Prune old messages: keep only last 15
    const allMessages = await prisma.aIConversation.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (allMessages.length > 15) {
      const idsToDelete = allMessages.slice(15).map((m) => m.id);
      await prisma.aIConversation.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    return NextResponse.json({
      message: result.message,
      actions: executedActions,
      source: result.source,
    });
  } catch (err) {
    console.error("AI chat error:", err instanceof Error ? err.stack : err);
    return NextResponse.json({
      message: "أهلاً بيك! أنا مرشدك الذكي على Code-UP 🌟\n\nأنا هنا لمساعدتك! اختار خطة تدريبية أو حلل أدائك أو اسألني أي حاجة.",
      actions: [],
      source: "fallback",
    });
  }
}

export async function GET() {
  try {
    const session = await getStudentSession() ?? await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const history = await prisma.aIConversation.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "asc" },
      take: 15,
      select: {
        id: true,
        role: true,
        content: true,
        actions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ messages: history });
  } catch (err) {
    console.error("AI chat history error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getStudentSession() ?? await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    await prisma.aIConversation.deleteMany({
      where: { studentId: session.id },
    });

    const { MemoryManager } = await import("@/ai/memory/MemoryManager");
    MemoryManager.getInstance().clearSession(session.id);

    return NextResponse.json({ success: true, message: "تم مسح المحادثة وحذف السجل بالكامل" });
  } catch (err) {
    console.error("Delete conversation error:", err);
    return NextResponse.json({ error: "حدث خطأ أثناء مسح المحادثة" }, { status: 500 });
  }
}

async function executeAction(
  studentId: string,
  action: AIAction
): Promise<{ type: string; status: string; id?: string; error?: string }> {
  try {
    switch (action.type) {
      case "create_grade_request": {
        const p = action.payload as {
          quizId: string;
          reason: string;
          requestedScore?: number;
          evidence?: string;
        };
        if (!p?.quizId || !p?.reason) {
          return { type: action.type, status: "failed", error: "بيانات ناقصة" };
        }

        const result = await prisma.quizResult.findFirst({
          where: { quizId: p.quizId, studentId },
          include: {
            quiz: {
              include: {
                folder: { select: { courseId: true } },
              },
            },
          },
        });

        if (!result) {
          return { type: action.type, status: "failed", error: "لم يتم حل هذا الكويز" };
        }

        let aiAnalysis = "تم إنشاء الطلب بواسطة المساعد الذكي بناءً على شكوى المتعلم";
        if (p.evidence) {
          try {
            const ctx = JSON.parse(p.evidence) as { chatHistory?: string; studentInfo?: string };
            const parts = [aiAnalysis];
            if (ctx.studentInfo) parts.push(`\n\n📋 بيانات المتعلم:\n${ctx.studentInfo}`);
            if (ctx.chatHistory) parts.push(`\n\n💬 سجل المحادثة:\n${ctx.chatHistory}`);
            aiAnalysis = parts.join("");
          } catch { /* keep default */ }
        }

        const req = await prisma.gradeAdjustmentRequest.create({
          data: {
            studentId,
            quizId: p.quizId,
            courseId: result.quiz.folder?.courseId ?? "plan",
            requestedBy: "student",
            currentScore: result.score,
            requestedScore: p.requestedScore ?? null,
            reason: p.reason,
            aiAnalysis,
            evidence: p.evidence ?? null,
            status: "pending",
          },
        });

        return { type: action.type, status: "created", id: req.id };
      }

      case "create_ticket": {
        const p = action.payload as {
          title: string;
          description: string;
          type: string;
          priority?: string;
          courseId?: string;
          chatHistory?: string;
          studentInfo?: string;
        };
        if (!p?.title || !p?.description) {
          return { type: action.type, status: "failed", error: "بيانات ناقصة" };
        }

        if (p.courseId) {
          const { checkCourseEnrollment } = await import("@/lib/authorization");
          const isEnrolled = await checkCourseEnrollment(studentId, p.courseId);
          if (!isEnrolled) {
            return { type: action.type, status: "failed", error: "غير مسجل في هذا الكورس" };
          }
        }

        let aiResponse: string | null = null;
        if (p.chatHistory || p.studentInfo) {
          const parts: string[] = [];
          if (p.studentInfo) parts.push(`📋 بيانات المتعلم:\n${p.studentInfo}`);
          if (p.chatHistory) parts.push(`💬 سجل المحادثة:\n${p.chatHistory}`);
          aiResponse = parts.join("\n\n");
        }

        const ticket = await prisma.supportTicket.create({
          data: {
            studentId,
            courseId: p.courseId ?? null,
            title: p.title,
            description: p.description,
            type: p.type || "complaint",
            priority: p.priority || "normal",
            aiHandled: true,
            aiResponse,
            status: "open",
          },
        });

        return { type: action.type, status: "created", id: ticket.id };
      }

      case "submit_feedback": {
        const p = action.payload as {
          courseId: string;
          type: string;
          content: string;
          rating?: number;
        };
        if (!p?.courseId || !p?.content) {
          return { type: action.type, status: "failed", error: "بيانات ناقصة" };
        }

        const { checkCourseEnrollment } = await import("@/lib/authorization");
        const isEnrolled = await checkCourseEnrollment(studentId, p.courseId);
        if (!isEnrolled) {
          return { type: action.type, status: "failed", error: "غير مسجل في هذا الكورس" };
        }

        const course = await prisma.course.findUnique({
          where: { id: p.courseId },
          select: { teacherId: true },
        });
        if (!course) {
          return { type: action.type, status: "failed", error: "الكورس غير موجود" };
        }

        const fb = await prisma.studentFeedback.create({
          data: {
            studentId,
            courseId: p.courseId,
            teacherId: course.teacherId,
            type: p.type || "other",
            content: p.content,
            rating: p.rating ?? null,
            aiAnalyzed: true,
          },
        });

        return { type: action.type, status: "created", id: fb.id };
      }

      case "navigate":
      case "show_insights":
      case "none":
        return { type: action.type, status: "ok" };

      default:
        return { type: "unknown", status: "ignored" };
    }
  } catch (err) {
    console.error("Action execution error:", err);
    return {
      type: action.type,
      status: "failed",
      error: err instanceof Error ? err.message : "خطأ غير معروف",
    };
  }
}
