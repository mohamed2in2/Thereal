// =========================================================
// LIVE AGENT — Code-UP Platform (CLIENT-SIDE ONLY)
// WebSocket connection to Gemini Live API (∞ RPD quota).
// Use for: real-time student chat, voice, translation.
// =========================================================

// Live model IDs
export type LiveModel =
  | "gemini-2.0-flash-live-001"                      // Gemini Flash Live — text chat (∞)
  | "gemini-2.5-flash-preview-native-audio-dialog";  // Native Audio — voice (∞)

export interface LiveSession {
  send: (text: string) => void;
  close: () => void;
  isReady: () => boolean;
}

// ── Core WebSocket factory ─────────────────────────────────────────────────
export function createLiveSession(params: {
  model: LiveModel;
  systemPrompt: string;
  onMessage: (text: string) => void;
  onReady?: () => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
  responseModality?: "TEXT" | "AUDIO";
}): LiveSession {
  const { model, systemPrompt, onMessage, onReady, onError, onClose } = params;
  const modality = params.responseModality ?? "TEXT";
  // Key injected at runtime when Live API is enabled — empty by default
  const apiKey   = process.env.NEXT_PUBLIC_GEMINI_LIVE_KEY ?? "";

  const ws = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
  );

  let ready = false;
  const queue: string[] = [];

  ws.onopen = () => {
    ws.send(JSON.stringify({
      setup: {
        model: `models/${model}`,
        system_instruction: { parts: [{ text: systemPrompt }] },
        generation_config: { response_modalities: [modality] },
      },
    }));
  };

  ws.onmessage = (event) => {
    let data: Record<string, unknown>;
    try { data = JSON.parse(event.data as string); } catch { return; }

    if (data.setupComplete) {
      ready = true;
      queue.forEach(msg => ws.send(msg));
      queue.length = 0;
      onReady?.();
      return;
    }

    // Extract text from model turn
    type Part = { text?: string; inlineData?: unknown };
    type Turn = { parts?: Part[] };
    const turn = (data.serverContent as { modelTurn?: Turn } | undefined)?.modelTurn;
    const text = turn?.parts?.map(p => p.text ?? "").join("") ?? "";
    if (text) onMessage(text);
  };

  ws.onerror = () => onError?.(new Error("WebSocket connection error"));
  ws.onclose = () => { ready = false; onClose?.(); };

  const buildClientMsg = (text: string) => JSON.stringify({
    client_content: {
      turns: [{ role: "user", parts: [{ text }] }],
      turn_complete: true,
    },
  });

  return {
    send: (text: string) => {
      const msg = buildClientMsg(text);
      if (ready) ws.send(msg);
      else queue.push(msg);
    },
    close: () => ws.close(),
    isReady: () => ready,
  };
}

// ── System prompts ─────────────────────────────────────────────────────────

export const CHAT_TUTOR_PROMPT = `
أنت مدرس ذكي ومشجع داخل منصة Code-UP التعليمية للطلاب المصريين.

قواعدك الصارمة:
- اشرح بالعربية البسيطة الواضحة
- لا تعطِ الإجابة مباشرة — ساعد الطالب يكتشفها بنفسه
- ردودك قصيرة ومحددة: 2-3 جمل كحد أقصى لكل رد
- شجّع الطالب دائماً حتى لو غلط — قل له "كدة كويس، جرب كمان"
- لو سألك عن موضوع خارج المنهج، ارجعه للمادة بلطف
- استخدم مثالاً عملياً واحداً عند الشرح
`.trim();

export const GAME_TUTOR_PROMPT = (subject: string, level: number) => `
أنت مساعد ذكي لطالب يلعب لعبة تعليمية في مادة ${subject} — المستوى ${level}.

قواعدك:
- أعطِ تلميحاً واحداً فقط (جملة واحدة) لا يكشف الإجابة
- كون مشجعاً ومختصراً جداً
- استخدم كلمات بسيطة مناسبة للطالب
`.trim();

export const IQ_COACH_PROMPT = `
أنت مدرب IQ متخصص في منصة Code-UP.
مهمتك: تحليل أداء الطالب وإعطاؤه توجيهاً سريعاً لتحسين ذكائه.
قواعد:
- ركز على نقطة تحسين واحدة في كل رد
- استخدم أمثلة من الحياة اليومية
- ردودك لا تتجاوز 3 جمل
`.trim();

// ── React hook (optional helper) ──────────────────────────────────────────
// Import in client components:
// const { messages, send, status } = useLiveChat("student-chat");

export function useLiveChat(
  model: LiveModel = "gemini-2.0-flash-live-001",
  systemPrompt: string = CHAT_TUTOR_PROMPT,
): {
  messages: { role: "user" | "ai"; text: string }[];
  status: "connecting" | "ready" | "closed" | "error";
  send: (text: string) => void;
  reset: () => void;
} {
  // Dynamic import to avoid SSR issues with React
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useState, useEffect, useRef, useCallback } = require("react") as typeof import("react");

  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [status, setStatus] = useState<"connecting" | "ready" | "closed" | "error">("connecting");
  const sessionRef = useRef<LiveSession | null>(null);

  const initSession = useCallback(() => {
    setStatus("connecting");
    sessionRef.current?.close();
    sessionRef.current = createLiveSession({
      model,
      systemPrompt,
      onMessage: (text) => setMessages(prev => {
        const last = prev[prev.length - 1];
        // Accumulate streaming tokens into the last AI message
        if (last?.role === "ai") return [...prev.slice(0, -1), { role: "ai", text: last.text + text }];
        return [...prev, { role: "ai", text }];
      }),
      onReady:  () => setStatus("ready"),
      onError:  () => setStatus("error"),
      onClose:  () => setStatus("closed"),
    });
  }, [model, systemPrompt]);

  useEffect(() => {
    initSession();
    return () => sessionRef.current?.close();
  }, [initSession]);

  const send = useCallback((text: string) => {
    if (!sessionRef.current) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    sessionRef.current.send(text);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    initSession();
  }, [initSession]);

  return { messages, status, send, reset };
}
