import { NextRequest, NextResponse } from "next/server";
import { getStudentSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStudentContext } from "@/lib/ai-context";
import { chatWithAI, type ChatMessage, type AIAction } from "@/lib/ai-assistant";

const activeAiRequests = new Map<string, number>();
const MAX_ACTIVE_AI_REQUESTS = 3;

export async function POST(req: NextRequest) {
  let requestSessionId: string | null = null;
  let requestCounted = false;
  try {
    // Accept students AND admins/owners (they need to test the chat too)
    const session = (await getStudentSession()) ?? (await getSession());
    if (!session) {
      return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" }, { status: 400 });
    }

    // Sanitise: strip ASCII control chars, cap at 4 000 chars
    const trimmedMsg = message
      .trim()
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, 4000);
    if (!trimmedMsg) {
      return NextResponse.json({ error: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" }, { status: 400 });
    }

    requestSessionId = session.id;
    const active = activeAiRequests.get(session.id) ?? 0;
    if (active >= MAX_ACTIVE_AI_REQUESTS) {
      return NextResponse.json(
        { error: "\u0647\u0646\u0627\u0643 \u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0646\u0634\u0637\u0629 \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u0644\u062D\u0638\u0627\u062A." },
        { status: 429 }
      );
    }
    activeAiRequests.set(session.id, active + 1);
    requestCounted = true;

    req.signal.addEventListener("abort", () => {}, { once: true });

    const cleanMsg = trimmedMsg.toLowerCase();
    const isSuperAdmin = session.role === "superadmin" || session.isOwner === true;
    const isAdmin = session.role === "admin" || isSuperAdmin;

    // ── SUPERADMIN MASTER AI COMMANDS & GLOBAL CONTROLS ────────────────────
    if (isSuperAdmin) {
      const isAccessInquiry =
        cleanMsg.includes("\u0635\u0644\u0627\u062D\u064A\u0627\u062A") ||
        cleanMsg.includes("access") ||
        cleanMsg.includes("powers") ||
        cleanMsg.includes("\u062A\u0642\u062F\u0631 \u062A\u0639\u0645\u0644 \u0627\u064A\u0647") ||
        cleanMsg.includes("\u062A\u0642\u062F\u0631 \u062A\u0639\u0645\u0644 \u0625\u064A\u0647") ||
        cleanMsg.includes("\u0623\u0648\u0627\u0645\u0631\u0643") ||
        cleanMsg.includes("\u0627\u0648\u0627\u0645\u0631\u0643") ||
        cleanMsg.includes("\u0627\u0644\u0627\u0648\u0627\u0645\u0631") ||
        cleanMsg.includes("\u0627\u0644\u0623\u0648\u0627\u0645\u0631") ||
        cleanMsg === "help" ||
        cleanMsg === "superadmin" ||
        cleanMsg === "admin";

      if (isAccessInquiry) {
        const { ConfigManager } = await import("@/ai/config/AIConfig");
        const currentPrimary = ConfigManager.getInstance().getConfig().primaryProvider;

        let activeName = "Google Gemini Pool (Primary)";
        if (currentPrimary === "digitalocean") activeName = "DigitalOcean Premium (Llama-3.3-70B)";
        else if (currentPrimary === "deepseek" || currentPrimary === "deepseek_v4_flash") activeName = "DeepSeek V4 Flash";
        else if (currentPrimary === "mock") activeName = "Mock Provider (Local)";

        const accessBriefing =
          `\u{1F451} **\u0644\u0648\u062D\u0629 \u062A\u062D\u0643\u0645 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0627\u0645 (Superadmin Master Access Control)**\n\n` +
          `\u0623\u0647\u0644\u064B\u0627 \u0628\u0643 \u064A\u0627 \u0641\u0646\u062F\u0645! \u0628\u0635\u0641\u062A\u0643 **\u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0627\u0645 (Superadmin)**\u060C \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u0644\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0643\u0627\u0641\u0629 \u0645\u062D\u0631\u0643\u0627\u062A \u0648\u0645\u0646\u0638\u0648\u0645\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0639\u0644\u0649 \u0645\u0646\u0635\u0629 Code-UP \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629:\n\n` +
          `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
          `\u{1F310} **1. \u0627\u0644\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0641\u0648\u0631\u064A \u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0627\u0644\u0639\u0627\u0645 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0637\u0644\u0627\u0628 (Global Model Switcher)**:\n` +
          `\u2022 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0646\u0634\u0637 \u062D\u0627\u0644\u064A\u064B\u0627 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0637\u0644\u0627\u0628: \`${activeName}\`\n` +
          `\u2022 \u064A\u0645\u0643\u0646\u0643 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0645\u062D\u0631\u0643 \u0627\u0644\u0639\u0627\u0645 \u0644\u0643\u0644 \u0637\u0644\u0627\u0628 \u0627\u0644\u0645\u0646\u0635\u0629 \u0641\u064A \u0623\u064A \u0644\u062D\u0638\u0629 \u0628\u0645\u062C\u0631\u062F \u0643\u062A\u0627\u0628\u0629 \u0623\u064A \u0645\u0646 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062A\u0627\u0644\u064A\u0629:\n` +
          `  - \u{1F535} *"\u0634\u063A\u0651\u0644 \u062F\u064A\u0628 \u0633\u064A\u0643 \u0644\u0644\u0637\u0644\u0627\u0628"* \u0623\u0648 \`switch to deepseek\`\n` +
          `  - \u{1F7E2} *"\u0634\u063A\u0651\u0644 \u062C\u064A\u0645\u064A\u0646\u064A \u0644\u0644\u0637\u0644\u0627\u0628"* \u0623\u0648 \`switch to gemini\`\n` +
          `  - \u26A1 *"\u0634\u063A\u0651\u0644 \u062F\u064A\u062C\u064A\u062A\u0627\u0644 \u0623\u0648\u0634\u0646 \u0644\u0644\u0637\u0644\u0627\u0628"* \u0623\u0648 \`switch to digitalocean\`\n` +
          `  - \u{1F7E1} *"\u0634\u063A\u0651\u0644 mock \u0644\u0644\u0637\u0644\u0627\u0628"* \u0623\u0648 \`switch to mock\`\n\n` +
          `\u{1F4CA} **2. \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0648\u0627\u0644\u062A\u0643\u0627\u0644\u064A\u0641 \u0627\u0644\u0641\u0648\u0631\u064A\u0629 (Live Telemetry & Costs)**:\n` +
          `\u2022 \u0627\u0643\u062A\u0628 \`Ahmed123M\` \u0623\u0648 \`stats\` \u0644\u0639\u0631\u0636 \u062A\u0642\u0631\u064A\u0631 \u0641\u0648\u0631\u064A.\n\n` +
          `\u{1F3C6} **3. \u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0644\u0648\u062D\u0629 \u0627\u0644\u0634\u0631\u0641 24H \u0648\u0627\u0644\u062C\u0648\u0627\u0626\u0632 (Daily Leaderboard Control)**\n\n` +
          `\u{1F6E1}\uFE0F **4. \u062C\u062F\u0627\u0631 \u0627\u0644\u062D\u0645\u0627\u064A\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646 \u0644\u0644\u0637\u0644\u0627\u0628 (AI Firewall & Moderation)**\n\n` +
          `\u2699\uFE0F **5. \u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u0623\u062F\u0627\u0621 \u0627\u0644\u0641\u0627\u0626\u0642\u0629 (Execution Modes)**:\n` +
          `\u2022 \`AhmedToldMeSotalkelse\` : \u062A\u0641\u0639\u064A\u0644 \u0648\u0636\u0639 \u0627\u0644\u0645\u0637\u0648\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631.\n` +
          `\u2022 \`AhmedProMode\` : \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0645\u0647\u0646\u064A \u0627\u0644\u0631\u0633\u0645\u064A.\n` +
          `\u2022 \`AhmedFastMode\` : \u0648\u0636\u0639 \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0641\u0627\u0626\u0642\u0629 \u0627\u0644\u0633\u0631\u0639\u0629.\n` +
          `\u2022 \`AhmedReset\` : \u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0648\u0627\u0644\u0630\u0627\u0643\u0631\u0629.\n\n` +
          `\u{1F4A1} *\u0623\u0646\u0627 \u062C\u0627\u0647\u0632 \u0644\u062A\u0646\u0641\u064A\u0630 \u0623\u064A \u0623\u0645\u0631 \u062A\u0631\u064A\u062F\u0647 \u0627\u0644\u0622\u0646!*`;

        return NextResponse.json({
          message: accessBriefing,
          actions: [],
          source: "superadmin_access",
        });
      }

      const isSwitchIntent =
        cleanMsg.includes("\u063A\u064A\u0631") ||
        cleanMsg.includes("\u062D\u0648\u0644") ||
        cleanMsg.includes("\u062E\u0644") ||
        cleanMsg.includes("\u0634\u063A\u0644") ||
        cleanMsg.includes("\u0634\u063A\u0651\u0644") ||
        cleanMsg.includes("\u0627\u0633\u062A\u062E\u062F\u0645") ||
        cleanMsg.includes("switch") ||
        cleanMsg.includes("use") ||
        cleanMsg.includes("set") ||
        cleanMsg.includes("talk") ||
        cleanMsg.includes("\u0637\u0627\u0644\u0628") ||
        cleanMsg.includes("\u0637\u0644\u0627\u0628") ||
        cleanMsg.includes("student") ||
        cleanMsg.includes("\u0627\u0644\u0646\u0645\u0648\u0630\u062C") ||
        cleanMsg.includes("model");

      const wantsDeepSeek = cleanMsg.includes("deepseek") || cleanMsg.includes("\u062F\u064A\u0628 \u0633\u064A\u0643") || cleanMsg.includes("\u062F\u064A\u0628\u0633\u064A\u0643");
      const wantsGemini = cleanMsg.includes("gemini") || cleanMsg.includes("\u062C\u064A\u0645\u064A\u0646\u064A") || cleanMsg.includes("\u062C\u064A\u0645\u064A\u0646\u0649") || cleanMsg.includes("\u062C\u0648\u062C\u0644");
      const wantsDO = cleanMsg.includes("digitalocean") || cleanMsg.includes("\u062F\u064A\u062C\u064A\u062A\u0627\u0644") || cleanMsg.includes("llama") || cleanMsg.includes("codeup");
      const wantsMock = cleanMsg.includes("mock") || cleanMsg.includes("\u0645\u062D\u0627\u0643\u064A") || cleanMsg.includes("\u062A\u062C\u0631\u064A\u0628\u064A");

      if (isSwitchIntent && (wantsDeepSeek || wantsGemini || wantsDO || wantsMock)) {
        const { ConfigManager } = await import("@/ai/config/AIConfig");
        const configMgr = ConfigManager.getInstance();

        let targetSlug = "gemini";
        let targetTitle = "Google Gemini Pool (Primary)";
        let targetDesc = "\u0645\u062D\u0631\u0643 \u062C\u0648\u062C\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0648\u0627\u0644\u0645\u062E\u0635\u0635 \u0644\u0644\u0634\u0631\u062D \u0627\u0644\u0623\u0643\u0627\u062F\u064A\u0645\u064A \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0630\u0643\u064A.";

        if (wantsDeepSeek) {
          targetSlug = "deepseek";
          targetTitle = "DeepSeek V4 Flash";
          targetDesc = "\u0645\u062D\u0631\u0643 DeepSeek \u0639\u0627\u0644\u064A \u0627\u0644\u062F\u0642\u0629 \u0648\u0633\u0631\u064A\u0639 \u0627\u0644\u0628\u062F\u064A\u0647\u0629 \u0641\u064A \u0627\u0644\u0628\u0631\u0645\u062C\u0629 \u0648\u0627\u0644\u062D\u0644\u0648\u0644 \u0627\u0644\u0645\u0639\u0642\u062F\u0629.";
        } else if (wantsDO) {
          targetSlug = "digitalocean";
          targetTitle = "Code-UP Platform Assistant (DigitalOcean Premium Llama-3.3-70B)";
          targetDesc = "\u0646\u0645\u0648\u0630\u062C Llama-3.3 \u0627\u0644\u0645\u062A\u0645\u064A\u0632 \u0627\u0644\u0645\u0633\u062A\u0636\u0627\u0641 \u0639\u0644\u0649 DigitalOcean \u0639\u0627\u0644\u064A \u0627\u0644\u0623\u062F\u0627\u0621.";
        } else if (wantsMock) {
          targetSlug = "mock";
          targetTitle = "Mock Local Provider (Local Test)";
          targetDesc = "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u062D\u0644\u064A \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A \u0627\u0644\u0633\u0631\u064A\u0639 \u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0646\u0638\u0627\u0645.";
        }

        configMgr.updateConfig({ primaryProvider: targetSlug });

        try {
          await prisma.aIProvider.updateMany({ data: { isPrimary: false } });
          await prisma.aIProvider.updateMany({
            where: { slug: targetSlug },
            data: { isPrimary: true, isActive: true },
          });
        } catch {
          // In-memory update took effect
        }

        const confirmText =
          `\u{1F451} **\u062A\u0645 \u062A\u0646\u0641\u064A\u0630 \u0623\u0645\u0631 \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u062C\u0627\u062D! (Global AI Model Updated)**\n\n` +
          `\u{1F310} **\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0646\u0634\u0637 \u0627\u0644\u0639\u0627\u0645 \u0644\u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0622\u0646**: \`${targetTitle}\`\n` +
          `\u{1F4DD} **\u0627\u0644\u0648\u0635\u0641**: ${targetDesc}\n\n` +
          `\u26A1 **\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u0635\u0629**: \u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u062C\u0645\u064A\u0639 \u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0637\u0644\u0627\u0628 \u0641\u0648\u0631\u064B\u0627 \u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 **${targetTitle}**.\n\n` +
          `\u{1F4A1} *\u064A\u0645\u0643\u0646\u0643 \u0641\u064A \u0623\u064A \u0648\u0642\u062A \u0643\u062A\u0627\u0628\u0629 "\u0635\u0644\u0627\u062D\u064A\u0627\u062A" \u0644\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0645\u062C\u062F\u062F\u064B\u0627.*`;

        return NextResponse.json({
          message: confirmText,
          actions: [],
          source: "superadmin_model_switch",
        });
      }
    }

    // ── STRICT ADMIN-ONLY CHEAT CODES & DEVELOPER TOOLS ──────────────────
    if (isAdmin) {
      const lastAssistantMsg = await prisma.aIConversation
        .findFirst({
          where: { studentId: session.id, role: "assistant" },
          orderBy: { createdAt: "desc" },
          select: { content: true },
        })
        .catch(() => null);
      const isAfterDevMenu =
        lastAssistantMsg?.content?.includes("[\u0645:dev_menu]") ||
        lastAssistantMsg?.content?.includes("Secret AI Model Switcher");

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
        if (config.primaryProvider === "digitalocean") activeModel = "Code-UP Platform Assistant (DigitalOcean Premium)";
        else if (config.primaryProvider === "gemini") activeModel = "Google Gemini Pool (Primary)";
        else if (config.primaryProvider === "deepseek" || config.primaryProvider === "deepseek_v4_flash") activeModel = "DeepSeek V4 Flash";

        const geminiRequests = metrics.requestsByProvider["gemini"] || 0;
        const geminiCost = providerCosts["gemini"] || 0;
        const doRequests = metrics.requestsByProvider["digitalocean"] || 0;
        const doCost = providerCosts["digitalocean"] || 0;
        const deepseekRequests = (metrics.requestsByProvider["deepseek_v4_flash"] || 0) + (metrics.requestsByProvider["deepseek"] || 0);
        const deepseekCost = (providerCosts["deepseek_v4_flash"] || 0) + (providerCosts["deepseek"] || 0);
        const mockRequests = metrics.requestsByProvider["mock"] || 0;

        const statsText =
          `\u{1F4CA} **\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0641\u0648\u0631\u064A (Ahmed123M Live Stats)**\n\n` +
          `\u{1F916} **\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0646\u0634\u0637**: \`${activeModel}\`\n` +
          `\u{1F504} **\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639**: \`DigitalOcean \u27A4 Gemini Pool \u27A4 Mock \u27A4 DeepSeek\`\n` +
          `\u{1F465} **\u0645\u0633\u062A\u062E\u062F\u0645\u0648 \u0627\u0644\u064A\u0648\u0645**: ${uniqueUsersToday}\n` +
          `\u{1F4AC} **\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u064A\u0648\u0645**: ${totalMessagesToday}\n\n` +
          `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
          `\u{1F4B8} **\u062A\u0643\u0627\u0644\u064A\u0641 \u0627\u0644\u0645\u0632\u0648\u062F\u064A\u0646**:\n` +
          `\u2022 \u0625\u062C\u0645\u0627\u0644\u064A: \`$${totalCostUsd.toFixed(6)} USD\`\n` +
          `\u2022 \u26A1 DigitalOcean: ${doRequests} \u0637\u0644\u0628 | \`$${doCost.toFixed(6)} USD\`\n` +
          `\u2022 \u{1F7E2} Gemini Pool: ${geminiRequests} \u0637\u0644\u0628 | \`$${geminiCost.toFixed(6)} USD\`\n` +
          `\u2022 \u{1F7E1} Mock: ${mockRequests} \u0637\u0644\u0628 | \`$0.00 USD\`\n` +
          `\u2022 \u{1F535} DeepSeek: ${deepseekRequests} \u0637\u0644\u0628 | \`$${deepseekCost.toFixed(6)} USD\`\n\n` +
          `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
          `\u{1F6E1}\uFE0F **\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646**:\n` +
          `\u2022 \u0627\u0633\u062A\u0647\u0644\u0627\u0643: \`$${totalCostUsd.toFixed(4)} / $50.00 USD\`\n` +
          `\u2022 \u0625\u062C\u0645\u0627\u0644\u064A \u062A\u0648\u0643\u0646\u0632: ${metrics.totalTokensUsed}\n` +
          `\u2022 \u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629: ${Math.round(metrics.averageLatencyMs)} ms`;

        return NextResponse.json({ message: statsText, actions: [], source: "admin_stats" });
      }

      const isDevSecretTrigger = cleanMsg.includes("ahmedtoldmesotalkelse") || cleanMsg === "dev" || cleanMsg === "developer";
      const isModelSwitchFollowUp =
        isAfterDevMenu &&
        ["1", "2", "3", "4", "do", "gemini", "deepseek", "mock", "digitalocean"].includes(cleanMsg);

      if (isDevSecretTrigger || isModelSwitchFollowUp) {
        const { ConfigManager } = await import("@/ai/config/AIConfig");
        const configMgr = ConfigManager.getInstance();

        let arg = cleanMsg
          .replace("ahmedtoldmesotalkelse", "")
          .replace("developer", "")
          .replace("dev", "")
          .trim();
        if (isModelSwitchFollowUp) arg = cleanMsg;

        if (arg === "1" || arg === "do" || arg === "digitalocean" || arg === "codeup") {
          configMgr.updateConfig({ primaryProvider: "digitalocean" });
          return NextResponse.json({ message: `\u{1F468}\u200D\u{1F4BB} **\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0648\u0636\u0639 \u0627\u0644\u0645\u0637\u0648\u0631 + \u062A\u062D\u0648\u064A\u0644 \u0625\u0644\u0649 DigitalOcean Premium (Llama-3.3-70B)**`, actions: [], source: "developer_mode" });
        } else if (arg === "2" || arg === "gemini") {
          configMgr.updateConfig({ primaryProvider: "gemini" });
          return NextResponse.json({ message: "\u{1F468}\u200D\u{1F4BB} **\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0625\u0644\u0649 Google Gemini Pool (Primary)**", actions: [], source: "developer_mode" });
        } else if (arg === "3" || arg === "deepseek") {
          configMgr.updateConfig({ primaryProvider: "deepseek" });
          return NextResponse.json({ message: "\u{1F468}\u200D\u{1F4BB} **\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0625\u0644\u0649 DeepSeek V4 Flash**", actions: [], source: "developer_mode" });
        } else if (arg === "4" || arg === "mock") {
          configMgr.updateConfig({ primaryProvider: "mock" });
          return NextResponse.json({ message: "\u{1F468}\u200D\u{1F4BB} **\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0625\u0644\u0649 Mock Provider (Local Test)**", actions: [], source: "developer_mode" });
        } else {
          const menuText =
            `\u{1F468}\u200D\u{1F4BB} **\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0648\u0636\u0639 \u0627\u0644\u0645\u0637\u0648\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 (Developer / Admin Mode Activated)**\n\n` +
            `\u0623\u0647\u0644\u064B\u0627 \u064A\u0627 \u0628\u0627\u0634\u0645\u0647\u0646\u062F\u0633!\n\n` +
            `\u{1F916} **\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0628\u0640 1-4**:\n` +
            `1\uFE0F\u20E3 DigitalOcean Premium (Llama-3.3-70B)\n` +
            `2\uFE0F\u20E3 Google Gemini Pool (Primary)\n` +
            `3\uFE0F\u20E3 DeepSeek V4 Flash\n` +
            `4\uFE0F\u20E3 Mock Provider (Local Test)\n\n[\u0645:dev_menu]`;
          return NextResponse.json({ message: menuText, actions: [], source: "developer_mode" });
        }
      }

      if (cleanMsg === "ahmedpromode" || cleanMsg === "professional" || cleanMsg === "pro") {
        return NextResponse.json({ message: "\u{1F454} **\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0645\u0647\u0646\u064A \u0627\u0644\u0645\u062A\u0642\u062F\u0645 (Professional Mode)**\n\n[\u0645:pro_mode]", actions: [], source: "pro_mode" });
      }

      if (cleanMsg === "ahmedfastmode" || cleanMsg === "fast" || cleanMsg === "speed") {
        return NextResponse.json({ message: "\u26A1 **\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0648\u0636\u0639 \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0641\u0627\u0626\u0642\u0629 (Fast Latency Mode)**\n\n[\u0645:fast_mode]", actions: [], source: "fast_mode" });
      }
    }

    // ── Conversation reset command (explicit only, not generic English words) ──
    // "clear" and "delete" are too common in Arabic/English chat to be safe
    // triggers for wiping history; only respond to explicit reset commands.
    if (
      cleanMsg === "ahmedreset" ||
      trimmedMsg === "\u0645\u0633\u062D \u0645\u062D\u0627\u062F\u062B\u062A\u064A" ||
      trimmedMsg === "\u0627\u062D\u0630\u0641 \u0645\u062D\u0627\u062F\u062B\u062A\u064A"
    ) {
      await prisma.aIConversation.deleteMany({ where: { studentId: session.id } });
      const { MemoryManager } = await import("@/ai/memory/MemoryManager");
      MemoryManager.getInstance().clearSession(session.id);
      return NextResponse.json({
        message: "\u{1F5D1}\uFE0F **\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0628\u0646\u062C\u0627\u062D!**\n\n\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0627\u0644\u0633\u062C\u0644 \u0628\u0627\u0644\u0643\u0627\u0645\u0644.",
        actions: [],
        source: "chat_cleared",
      });
    }

    // Parallelize pre-flight context & history queries
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [context, history, notifData] = await Promise.all([
      buildStudentContext(session.id).catch((ctxErr) => {
        console.error("[chat/route] buildStudentContext failed:", ctxErr);
        return {
          profile: { id: session.id, name: session.name || "\u0627\u0644\u0637\u0627\u0644\u0628", email: session.email || "", age: null, educationalStage: null, phone: null },
          courses: [],
          overallStats: { totalCourses: 0, averageScore: 0, totalQuizzesTaken: 0, totalVideosWatched: 0 },
          weakAreas: [],
          aiInsights: [],
          recentFeedback: [],
          libraryProgress: [],
        };
      }),
      prisma.aIConversation.findMany({
        where: { studentId: session.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, role: true, content: true },
      }).catch(() => []),
      Promise.all([
        prisma.gradeAdjustmentRequest.findMany({
          where: { studentId: session.id, status: { in: ["approved", "rejected"] }, reviewedAt: { gte: sevenDaysAgo } },
          include: { quiz: { select: { title: true } } },
          orderBy: { reviewedAt: "desc" },
          take: 2,
        }).catch(() => []),
        prisma.supportTicket.findMany({
          where: { studentId: session.id, status: { in: ["resolved", "closed"] }, updatedAt: { gte: sevenDaysAgo } },
          orderBy: { updatedAt: "desc" },
          take: 2,
        }).catch(() => []),
      ]).catch(() => [[], []]),
    ]);

    // Save user message AFTER validation (use sanitised trimmedMsg, not raw message)
    await prisma.aIConversation.create({
      data: { studentId: session.id, role: "user", content: trimmedMsg },
    }).catch(() => null);

    const chatHistory: ChatMessage[] = history
      .reverse()
      .map((h) => ({ role: h.role as ChatMessage["role"], content: h.content }));

    const notifItems: string[] = [];
    const [recentGrades, recentTickets] = (notifData || [[], []]) as [any[], any[]];
    for (const r of recentGrades) {
      notifItems.push(`\u062A\u0639\u062F\u064A\u0644 \u062F\u0631\u062C\u0629 "${r.quiz?.title || "\u0643\u0648\u064A\u0632"}": ${r.status === "approved" ? "\u0645\u0642\u0628\u0648\u0644 \u2705" : "\u0645\u0631\u0641\u0648\u0636 \u274C"}${r.teacherNotes ? ` - ${r.teacherNotes}` : ""}`);
    }
    for (const t of recentTickets) {
      notifItems.push(`"${t.title}": ${t.status === "resolved" ? "\u062A\u0645 \u0627\u0644\u062D\u0644 \u2705" : "\u0645\u063A\u0644\u0642"}${t.resolution ? ` - ${t.resolution}` : ""}`);
    }
    const notifications =
      notifItems.length > 0
        ? `\u062A\u062D\u062F\u064A\u062B\u0627\u062A \u0637\u0644\u0628\u0627\u062A\u0643:\n${notifItems.map((n) => `\u2022 ${n}`).join("\n")}`
        : undefined;

    let result;
    try {
      result = await chatWithAI(trimmedMsg, chatHistory, context, notifications, req.signal);
    } catch (chatErr) {
      console.error("[chat/route] chatWithAI threw:", chatErr);
      result = {
        message: "\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0642\u064A\u062F \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u062D\u0627\u0644\u064A\u064B\u0627\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627 \u23F3",
        actions: [] as AIAction[],
        source: "fallback" as const,
      };
    }

    const executedActions: Array<{ type: string; status: string; id?: string; error?: string }> = [];
    for (const action of result.actions) {
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
        let statusMsg = "\u{1F4CB} \u062D\u0627\u0644\u0629 \u0637\u0644\u0628\u0627\u062A\u064A:\n\n";
        if (gradeReqs.length === 0 && ticketReqs.length === 0) {
          statusMsg += "\u0645\u0641\u064A\u0634 \u0637\u0644\u0628\u0627\u062A \u0644\u0633\u0647.\n";
        } else {
          if (gradeReqs.length > 0) {
            statusMsg += "\u270F\uFE0F \u0637\u0644\u0628\u0627\u062A \u062A\u0639\u062F\u064A\u0644 \u062F\u0631\u062C\u0629:\n";
            for (const r of gradeReqs) {
              const lbl = r.status === "approved" ? "\u0645\u0642\u0628\u0648\u0644 \u2705" : r.status === "rejected" ? "\u0645\u0631\u0641\u0648\u0636 \u274C" : "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u23F3";
              statusMsg += `\u2022 ${r.quiz.title}: ${lbl}${r.teacherNotes ? ` (${r.teacherNotes})` : ""}\n`;
            }
            statusMsg += "\n";
          }
          if (ticketReqs.length > 0) {
            statusMsg += "\u{1F4E2} \u0627\u0644\u0634\u0643\u0627\u0648\u0649:\n";
            for (const t of ticketReqs) {
              const lbl = t.status === "resolved" ? "\u062A\u0645 \u0627\u0644\u062D\u0644 \u2705" : t.status === "closed" ? "\u0645\u063A\u0644\u0648\u0642" : t.status === "escalated" ? "\u062A\u0645 \u0627\u0644\u062A\u0635\u0639\u064A\u062F \u2191" : "\u0645\u0641\u062A\u0648\u062D \u23F3";
              statusMsg += `\u2022 ${t.title}: ${lbl}${t.resolution ? ` (${t.resolution})` : ""}\n`;
            }
          }
        }
        statusMsg += "\n\u0627\u0643\u062A\u0628 0 \u0644\u0644\u0631\u062C\u0648\u0639\n\n[\u0645:5]";
        result.message = statusMsg;
        executedActions.push({ type: "show_insights", status: "ok" });
        continue;
      }
      const exec = await executeAction(session.id, action);
      executedActions.push(exec);
    }

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

    // Prune old messages: keep only last 15 (atomic-enough: tail delete is idempotent)
    const allMessages = await prisma.aIConversation.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (allMessages.length > 15) {
      const idsToDelete = allMessages.slice(15).map((m) => m.id);
      await prisma.aIConversation.deleteMany({ where: { id: { in: idsToDelete } } });
    }

    return NextResponse.json({
      message: result.message,
      actions: executedActions,
      source: result.source,
    });
  } catch (err) {
    console.error("AI chat error:", err instanceof Error ? err.stack : err);
    return NextResponse.json({
      message: "\u0623\u0647\u0644\u064B\u0627 \u0628\u064A\u0643! \u0623\u0646\u0627 \u0645\u0631\u0634\u062F\u0643 \u0627\u0644\u0630\u0643\u064A \u0639\u0644\u0649 Code-UP \u{1F31F}\n\n\u0623\u0646\u0627 \u0647\u0646\u0627 \u0644\u0645\u0633\u0627\u0639\u062F\u062A\u0643!",
      actions: [],
      source: "fallback",
    });
  } finally {
    if (requestCounted && requestSessionId) {
      const remaining = (activeAiRequests.get(requestSessionId) ?? 1) - 1;
      if (remaining > 0) activeAiRequests.set(requestSessionId, remaining);
      else activeAiRequests.delete(requestSessionId);
    }
  }
}

export async function GET() {
  try {
    const session = (await getStudentSession()) ?? (await getSession());
    if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

    const history = await prisma.aIConversation.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "asc" },
      take: 15,
      select: { id: true, role: true, content: true, actions: true, createdAt: true },
    });

    return NextResponse.json({ messages: history });
  } catch (err) {
    console.error("AI chat history error:", err);
    return NextResponse.json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = (await getStudentSession()) ?? (await getSession());
    if (!session) return NextResponse.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, { status: 401 });

    await prisma.aIConversation.deleteMany({ where: { studentId: session.id } });
    const { MemoryManager } = await import("@/ai/memory/MemoryManager");
    MemoryManager.getInstance().clearSession(session.id);

    return NextResponse.json({ success: true, message: "\u062A\u0645 \u0645\u0633\u062D \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0648\u062D\u0630\u0641 \u0627\u0644\u0633\u062C\u0644 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" });
  } catch (err) {
    console.error("Delete conversation error:", err);
    return NextResponse.json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0633\u062D \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629" }, { status: 500 });
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
          return { type: action.type, status: "failed", error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" };
        }

        // Dedup: refuse to create a second pending request for the same quiz
        const existingPending = await prisma.gradeAdjustmentRequest.findFirst({
          where: { studentId, quizId: p.quizId, status: "pending" },
          select: { id: true },
        });
        if (existingPending) {
          return {
            type: action.type,
            status: "skipped",
            id: existingPending.id,
            error: "\u0644\u062F\u064A\u0643 \u0637\u0644\u0628 \u0645\u0639\u0644\u0642 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u064A\u0632 \u2014 \u0633\u064A\u062A\u0645 \u0645\u0631\u0627\u062C\u0639\u062A\u0647 \u0642\u0631\u064A\u0628\u064B\u0627.",
          };
        }

        const result = await prisma.quizResult.findFirst({
          where: { quizId: p.quizId, studentId },
          include: { quiz: { include: { folder: { select: { courseId: true } } } } },
        });
        if (!result) {
          return { type: action.type, status: "failed", error: "\u0644\u0645 \u064A\u062A\u0645 \u062D\u0644 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u064A\u0632" };
        }

        let aiAnalysis = "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0634\u0643\u0648\u0649 \u0627\u0644\u0645\u062A\u0639\u0644\u0645";
        if (p.evidence) {
          try {
            const ctx = JSON.parse(p.evidence) as { chatHistory?: string; studentInfo?: string };
            const parts = [aiAnalysis];
            if (ctx.studentInfo) parts.push(`\n\n\u{1F4CB} \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062A\u0639\u0644\u0645:\n${ctx.studentInfo}`);
            if (ctx.chatHistory) parts.push(`\n\n\u{1F4AC} \u0633\u062C\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629:\n${ctx.chatHistory}`);
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
          return { type: action.type, status: "failed", error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" };
        }

        if (p.courseId) {
          const { checkCourseEnrollment } = await import("@/lib/authorization");
          const isEnrolled = await checkCourseEnrollment(studentId, p.courseId);
          if (!isEnrolled) {
            return { type: action.type, status: "failed", error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0631\u0633" };
          }
        }

        let aiResponse: string | null = null;
        if (p.chatHistory || p.studentInfo) {
          const parts: string[] = [];
          if (p.studentInfo) parts.push(`\u{1F4CB} \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062A\u0639\u0644\u0645:\n${p.studentInfo}`);
          if (p.chatHistory) parts.push(`\u{1F4AC} \u0633\u062C\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629:\n${p.chatHistory}`);
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
          return { type: action.type, status: "failed", error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629" };
        }
        const { checkCourseEnrollment } = await import("@/lib/authorization");
        const isEnrolled = await checkCourseEnrollment(studentId, p.courseId);
        if (!isEnrolled) {
          return { type: action.type, status: "failed", error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0631\u0633" };
        }
        const course = await prisma.course.findUnique({
          where: { id: p.courseId },
          select: { teacherId: true },
        });
        if (!course) return { type: action.type, status: "failed", error: "\u0627\u0644\u0643\u0648\u0631\u0633 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };

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
      error: err instanceof Error ? err.message : "\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
    };
  }
}
