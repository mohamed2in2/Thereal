import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlanProviders, type ResolvedProvider } from "@/lib/ai-provider";
import { getConfigNumberClamped } from "@/lib/config";
import { acquireAdvisoryLock } from "@/lib/distributed-lock";

// GET — Fetch chat history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: planId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 50));
  const skip = (page - 1) * limit;
  
  try {
    const enrollment = await prisma.planEnrollment.findUnique({
      where: { planId_studentId: { planId, studentId: session.id } }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "لم تسجل في هذه الخطة بعد" }, { status: 403 });
    }

    const messages = await prisma.planAIChatMessage.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    });

    const total = await prisma.planAIChatMessage.count({
      where: { enrollmentId: enrollment.id }
    });

    return NextResponse.json({ 
      messages: messages.reverse(), 
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — Send chat message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id: planId } = await params;

  try {
    const enrollment = await prisma.planEnrollment.findUnique({
      where: { planId_studentId: { planId, studentId: session.id } },
      include: { plan: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "لم تسجل في هذه الخطة بعد" }, { status: 403 });
    }

    // Check if chat is enabled for this plan
    if (!enrollment.plan.chatEnabled) {
      return NextResponse.json({ error: "ميزة المحادثة مع المساعد الذكي معطلة لهذه الخطة" }, { status: 403 });
    }

    // Expiry check (Gap 45)
    const now = new Date();
    if (enrollment.expiresAt < now) {
      return NextResponse.json({ error: "انتهت صلاحية اشتراكك في هذه الخطة" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const content = String(body.content || "").trim();

    // Content limit (Gap 20)
    if (!content) {
      return NextResponse.json({ error: "محتوى الرسالة مطلوب" }, { status: 400 });
    }
    if (content.length > 4000) {
      return NextResponse.json({ error: "الرسالة طويلة جداً (الحد الأقصى 4000 حرف)" }, { status: 400 });
    }

    // Rate Limiting & Save student message in an atomic transaction
    const oneHourAgo = new Date(now.getTime() - 3600000);
    let studentMsg;
    try {
      studentMsg = await prisma.$transaction(async (tx: any) => {
        // Acquire advisory lock to serialize chat quota checks
        await acquireAdvisoryLock(`chat-limit-${session.id}`, tx);

        const messageCount = await tx.planAIChatMessage.count({
          where: {
            studentId: session.id,
            enrollmentId: enrollment.id,
            createdAt: { gte: oneHourAgo }
          }
        });

        if (messageCount >= 20) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        return await tx.planAIChatMessage.create({
          data: {
            enrollmentId: enrollment.id,
            studentId: session.id,
            role: "user",
            content
          }
        });
      });
    } catch (txErr: any) {
      if (txErr.message === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: "تجاوزت الحد الأقصى المسموح به (20 رسالة في الساعة)" }, { status: 429 });
      }
      throw txErr;
    }

    // History windowing: get last 20 messages (Gap 33)
    const pastMessages = await prisma.planAIChatMessage.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const chatHistory = [...pastMessages].reverse();

    // Resolve AI Providers
    const { primary, backup } = await resolvePlanProviders();
    const maxTokens = await getConfigNumberClamped("ai_max_tokens", 512, 4096);

    const systemPrompt = `You are a helpful Egyptian study assistant tutor for the educational plan: "${enrollment.plan.title}".
Educational Stage: ${enrollment.plan.educationalStage}
Answer the student's question in a clear, educational, and friendly way in Arabic, matching their educational level. Keep responses focused on the study material.`;

    let reply = "";
    if (primary) {
      try {
        reply = await callChatProvider(primary, systemPrompt, chatHistory, maxTokens);
      } catch (err) {
        console.error(`Primary chat provider failed:`, err);
      }
    }

    if (!reply && backup) {
      try {
        reply = await callChatProvider(backup, systemPrompt, chatHistory, maxTokens);
      } catch (err) {
        console.error(`Backup chat provider failed:`, err);
      }
    }

    if (!reply) {
      return NextResponse.json({ error: "مساعد الذكاء الاصطناعي غير متوفر حالياً" }, { status: 503 });
    }

    // Save assistant reply
    const assistantMsg = await prisma.planAIChatMessage.create({
      data: {
        enrollmentId: enrollment.id,
        studentId: session.id,
        role: "assistant",
        content: reply
      }
    });

    return NextResponse.json({ message: assistantMsg });
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

async function callChatProvider(
  provider: ResolvedProvider,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<string> {
  const base = provider.baseUrl.replace(/\/+$/, "");

  // Format messages
  const formattedMessages = history.map(h => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));

  if (provider.kind === "anthropic") {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: formattedMessages
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || "";
  } else if (provider.kind === "gemini") {
    // Gemini chat API formatting
    const contents = history.map(h => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }]
    }));
    const res = await fetch(`${base}/${provider.model}:generateContent?key=${provider.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: maxTokens }
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else {
    // OpenAI compatibility
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages
        ]
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }
}
