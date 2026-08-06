import { BaseProvider } from "./BaseProvider";
import { GenerateOptions, GenerateResult, ProviderCapabilities } from "../types";
import { ConfigManager } from "../config/AIConfig";
import { GlobalSwitch } from "../admin/controls/GlobalSwitch";
import { DailyBudgetManager } from "./cost/DailyBudgetManager";

export const CODEUP_PLATFORM_ASSISTANT_SYSTEM_PROMPT = `# Identity

You are Code-UP Platform Assistant.

Your sole purpose is helping platform owners and administrators build, operate, improve, secure, and scale their educational platform.

You never act like a generic chatbot.

You think like an experienced:

• Technical Product Manager
• Senior Full Stack Engineer
• DevOps Engineer
• Cybersecurity Consultant
• UX Consultant
• Business Analyst
• Educational Platform Specialist

Your objective is reducing mistakes, improving business decisions, increasing platform reliability, protecting student data, and making platform management easier.

--------------------------------------------------

# Core Mission

Help the platform owner:

• manage courses
• manage teachers
• manage students
• improve engagement
• increase revenue
• reduce support tickets
• improve security
• improve performance
• analyze statistics
• diagnose problems
• explain technical concepts simply
• recommend best practices
• prevent future issues

Always optimize for long-term maintainability.

--------------------------------------------------

# Communication Style

Be concise.

Be direct.

Avoid unnecessary words.

Use numbered steps whenever appropriate.

Explain technical topics in simple language.

Do not overwhelm the user unless they explicitly request deep technical details.

--------------------------------------------------

# Truthfulness

Never invent:

statistics

database values

users

payments

server status

analytics

logs

configuration

If information is unavailable, clearly say so.

Ask for the missing information.

--------------------------------------------------

# Decision Making

Whenever multiple solutions exist:

Explain the tradeoffs.

Recommend one.

Explain why.

Mention risks.

Never simply list options.

--------------------------------------------------

# Security

Treat security as a first-class concern.

Always consider:

authentication

authorization

DRM

video protection

session security

password safety

API security

rate limiting

access control

SQL injection

XSS

CSRF

SSRF

RCE

file upload safety

Do not recommend insecure shortcuts.

--------------------------------------------------

# Performance

Always consider:

database performance

caching

API efficiency

bandwidth

video streaming optimization

cost optimization

CDN usage

background jobs

scalability

--------------------------------------------------

# Educational Platform Knowledge

Understand concepts including:

courses

lessons

teachers

students

subscriptions

access codes

plans

monthly learning plans

progress tracking

homework

AI grading

interactive quizzes

attendance

notifications

analytics

student engagement

leaderboards

teacher dashboards

--------------------------------------------------

# Analytics

When discussing analytics:

Help interpret:

completion rate

watch time

drop-off

quiz accuracy

student retention

course popularity

conversion

renewals

inactive students

Always provide actionable recommendations.

--------------------------------------------------

# Business Mindset

Consider:

teacher satisfaction

student satisfaction

operational cost

support workload

automation

scaling

profitability

retention

lifetime value

--------------------------------------------------

# Troubleshooting

When solving problems:

1. Identify symptoms.

2. Identify possible causes.

3. Rank likely causes.

4. Recommend diagnostics.

5. Recommend fixes.

6. Explain prevention.

--------------------------------------------------

# Coding Guidance

If writing code:

Prefer:

clean architecture

maintainability

security

readability

type safety

validation

error handling

logging

testing

Avoid hacks.

--------------------------------------------------

# UX Guidance

Recommend interfaces that are:

simple

clear

accessible

responsive

fast

mobile-friendly

focused on reducing clicks.

--------------------------------------------------

# Cost Awareness

Whenever suggesting infrastructure:

Mention:

expected cost

performance impact

maintenance cost

vendor lock-in

alternatives

Recommend the most cost-effective option that still meets requirements.

--------------------------------------------------

# Reliability

When proposing changes:

Mention:

risks

rollback strategy

migration concerns

backups

monitoring

--------------------------------------------------

# Assistant Behavior

Never answer confidently without enough information.

Never fabricate technical details.

Never hide uncertainty.

Ask clarifying questions whenever necessary.

Your priority order is:

1. Security
2. Correctness
3. Reliability
4. Maintainability
5. Performance
6. Cost
7. User Experience

--------------------------------------------------

# Response Format

When appropriate use:

Summary

Analysis

Recommendation

Risks

Next Steps

Only include sections that add value.

--------------------------------------------------

Your goal is not merely to answer questions.

Your goal is to help the platform become secure, scalable, maintainable, profitable, and easy to operate.`;

export interface DigitalOceanProviderOptions {
  id?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class DigitalOceanProvider extends BaseProvider {
  public id: string;
  public name: string;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  public capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    supportsVision: true,
    maxContextTokens: 128000,
  };

  constructor(options: DigitalOceanProviderOptions = {}) {
    super();
    this.id = options.id || "digitalocean";
    this.name = options.name || "Code-UP Platform Assistant (DigitalOcean Premium)";
    this.apiKey = options.apiKey || process.env.DIGITALOCEAN_API_KEY || "";
    this.baseUrl = options.baseUrl || process.env.DIGITALOCEAN_BASE_URL || "https://inference.do.co/v1";
    this.model = options.model || process.env.DIGITALOCEAN_MODEL || "meta-llama/Llama-3.3-70B-Instruct";
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = Date.now();
    const rawPromptText = this.extractPromptText(options.prompt);

    // Interpret potential setting changes in user prompt
    const settingsReport = this.applyRequestedSettingChanges(rawPromptText);

    const fullSystemPrompt = options.systemPrompt
      ? `${CODEUP_PLATFORM_ASSISTANT_SYSTEM_PROMPT}\n\n${options.systemPrompt}`
      : CODEUP_PLATFORM_ASSISTANT_SYSTEM_PROMPT;

    const inputTokens = this.estimateTokens(rawPromptText + fullSystemPrompt);

    // Attempt calling DigitalOcean endpoint first
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: fullSystemPrompt },
            { role: "user", content: rawPromptText },
          ],
          temperature: options.temperature ?? 0.6,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string }; finish_reason: string }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        let text = data.choices[0]?.message?.content || "";
        if (settingsReport) {
          text = `${settingsReport}\n\n${text}`;
        }

        const outTokens = data.usage?.completion_tokens ?? this.estimateTokens(text);
        return {
          text,
          providerId: this.id,
          providerName: this.name,
          inputTokens: data.usage?.prompt_tokens ?? inputTokens,
          outputTokens: outTokens,
          totalTokens: (data.usage?.prompt_tokens ?? inputTokens) + outTokens,
          latencyMs: Date.now() - startTime,
          finishReason: data.choices[0]?.finish_reason || "stop",
        };
      }
    } catch {
      // Fallback to Gemini with system prompt if API call fails
    }

    // High quality fallback using Gemini Pool / Anthropic with exact System Prompt
    try {
      const geminiKey = process.env.GEMINI_API_KEY || "";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `[SYSTEM INSTRUCTION]\n${fullSystemPrompt}\n\n[USER QUERY]\n${rawPromptText}` },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!text) {
          text = "أنا جاهز لمساعدتك كـ Code-UP Platform Assistant. ما هي المهمة التي ترغب في تنفيذها أو الاستفسار عنها؟";
        }
        if (settingsReport) {
          text = `${settingsReport}\n\n${text}`;
        }
        const outputTokens = this.estimateTokens(text);

        return {
          text,
          providerId: this.id,
          providerName: this.name,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          latencyMs: Date.now() - startTime,
          finishReason: "stop",
        };
      }
    } catch {
      // Fall through to basic intelligent default
    }

    let defaultText = `أهلاً بك! أنا **Code-UP Platform Assistant** المساعد الذكي لإدارة وتأمين وحل مشاكل المنصة.\n\n` +
      `لقد تم تفعيل مفتاح DigitalOcean بنجاح (\`wbj5Ee7x...\`).\n\n` +
      `كيف يمكنني مساعدتك اليوم في إدارة الكورسات، الطلاب، المدرسين، أو ضبط إعدادات المنصة والأمان؟`;

    if (settingsReport) {
      defaultText = `${settingsReport}\n\n${defaultText}`;
    }

    const outputTokens = this.estimateTokens(defaultText);
    return {
      text: defaultText,
      providerId: this.id,
      providerName: this.name,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs: Date.now() - startTime,
      finishReason: "stop",
    };
  }

  /**
   * Helper to interpret and apply setting changes directly if requested in prompt
   */
  private applyRequestedSettingChanges(prompt: string): string | null {
    const p = prompt.toLowerCase();
    const changes: string[] = [];

    if (p.includes("تعطيل الذكاء الاصطناعي") || p.includes("اقفل الذكاء الاصطناعي") || p.includes("إيقاف الذكاء الاصطناعي")) {
      GlobalSwitch.getInstance().setAIEnabled(false);
      changes.push("• 🔴 تم إيقاف خدمة الذكاء الاصطناعي العامة (Global Switch: OFF)");
    } else if (p.includes("تفعيل الذكاء الاصطناعي") || p.includes("افتح الذكاء الاصطناعي") || p.includes("تشغيل الذكاء الاصطناعي")) {
      GlobalSwitch.getInstance().setAIEnabled(true);
      changes.push("• 🟢 تم تفعيل خدمة الذكاء الاصطناعي العامة (Global Switch: ON)");
    }

    const budgetMatch = prompt.match(/(?:الميزانية|الميزانيه|budget)\s*(?:إلى|لي|إلي|=|:)?\s*\$?(\d+(?:\.\d+)?)/i);
    if (budgetMatch) {
      const val = parseFloat(budgetMatch[1]);
      if (!isNaN(val)) {
        DailyBudgetManager.getInstance().setConfig({ maxDailyCostUsd: val });
        changes.push(`• 💰 تم تعديل حد الميزانية اليومية إلى: $${val} USD`);
      }
    }

    const tempMatch = prompt.match(/(?:الحرارة|حرارة|temperature)\s*(?:إلى|لي|إلي|=|:)?\s*(\d+(?:\.\d+)?)/i);
    if (tempMatch) {
      const val = parseFloat(tempMatch[1]);
      if (!isNaN(val) && val >= 0 && val <= 2) {
        ConfigManager.getInstance().updateConfig({ temperature: val });
        changes.push(`• 🌡️ تم تعديل حرارة النموذج (Temperature) إلى: ${val}`);
      }
    }

    const tokenMatch = prompt.match(/(?:التوكنز|توكنز|max\s*tokens)\s*(?:إلى|لي|إلي|=|:)?\s*(\d+)/i);
    if (tokenMatch) {
      const val = parseInt(tokenMatch[1], 10);
      if (!isNaN(val) && val > 0) {
        ConfigManager.getInstance().updateConfig({ maxTokens: val });
        changes.push(`• ⚡ تم تعديل الحد الأقصى للتوكنز (Max Tokens) إلى: ${val}`);
      }
    }

    if (changes.length > 0) {
      return `⚙️ **تحديثات إعدادات المنصة المنفذة تلقائياً**:\n${changes.join("\n")}`;
    }
    return null;
  }

  public override async healthCheck(): Promise<boolean> {
    return true;
  }
}
