"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

interface InteractiveQuestionOption {
  id: string;
  text: string;
}

interface InteractiveQuestionPayload {
  questionId?: string;
  topic?: string;
  question?: string;
  options?: InteractiveQuestionOption[];
  correctAnswer?: string;
  explanation?: string;
  hint?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface ChatAction {
  type: string;
  status?: string;
  id?: string;
  error?: string;
  path?: string;
  reason?: string;
  payload?: Record<string, unknown> | InteractiveQuestionPayload;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: string | null;
  createdAt?: string;
}

const QUICK_PROMPTS = [
  "🎯 اسألني سؤال واختبرني",
  "حلل أدائي وقولي نقاط ضعفي",
  "اعمللي خطة تدريبية للأسبوع",
  "اشرحلي الدرس الأول في المنهج",
  "في إجابة في كويز اتسجلت غلط",
];

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "أهلاً بيك! أنا مرشدك الذكي على Code-UP 🌟\n\nأنا بشوف كل بياناتك (درجاتك، تقدمك، كورساتك) وممكن أساعدك في:\n• تحليل أداءك ونقاط ضعفك\n• خطة تدريبية مخصصة ليك\n• لو في إجابة اتسجلت غلط — هعمل طلب تعديل للمعلم\n• شكاوى عن مدرس أو محتوى\n• توجيهك لأي حاجة في الموقع\n\nاتكلم معايا براحة!",
};

const AUTH_CACHE_KEY = "ai_auth_v1";
const AUTH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function readAuthCache(): { isStudent: boolean; aiEnabled: boolean } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const { ts, isStudent, aiEnabled } = JSON.parse(raw);
    if (Date.now() - ts > AUTH_CACHE_TTL) { sessionStorage.removeItem(AUTH_CACHE_KEY); return null; }
    return { isStudent, aiEnabled };
  } catch { return null; }
}

function writeAuthCache(isStudent: boolean, aiEnabled: boolean) {
  try { sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ts: Date.now(), isStudent, aiEnabled })); } catch { /* ignore */ }
}

export function AIAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasUser, setHasUser] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [unread, setUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Quick auth & status check
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((auth) => {
        if (auth?.user) {
          setHasUser(true);
        } else {
          setHasUser(false);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));

    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((st) => {
        if (st && typeof st.enabled === "boolean") {
          setAiEnabled(st.enabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for custom trigger from "Ask AI" buttons under video players
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ initialPrompt?: string }>;
      setMessages([WELCOME_MESSAGE]);
      const initialText = customEvent.detail?.initialPrompt || "";
      setInput(initialText);
      setSending(false);
      setUnread(false);
      setOpen(true);

      // If an initial question about the lesson is provided, automatically query the AI assistant
      if (initialText) {
        setTimeout(() => {
          void send(initialText);
        }, 100);
      }
    };
    window.addEventListener("open-ai-assistant", handler);
    return () => window.removeEventListener("open-ai-assistant", handler);
  }, []);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      const replyMessage = data?.message || (data?.error ? `⚠️ ${data.error}` : "عذراً، حدث تعذر مؤقت في الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      const actionsStr = data?.actions ? JSON.stringify(data.actions) : null;

      // Handle automatic or prompt navigation if requested
      if (Array.isArray(data?.actions)) {
        for (const act of data.actions) {
          const navPath = act?.payload?.path || act?.path;
          if (act.type === "navigate" && navPath) {
            const lowerMsg = message.toLowerCase();
            const isDirectTransferIntent =
              lowerMsg.includes("انقل") ||
              lowerMsg.includes("وديني") ||
              lowerMsg.includes("حولني") ||
              lowerMsg.includes("افتح") ||
              lowerMsg.includes("يلا") ||
              lowerMsg.includes("ماشي") ||
              lowerMsg.includes("تمام") ||
              lowerMsg.includes("go") ||
              lowerMsg.includes("transfer") ||
              lowerMsg.includes("navigate");

            if (isDirectTransferIntent) {
              setTimeout(() => {
                router.push(navPath);
              }, 1000);
            }
          }
        }
      }

      // Fast instant rendering for questions, actions, or concise responses (<200ms feel)
      const hasInteractiveAction = Array.isArray(data?.actions) && data.actions.some((a: any) => a?.type === "interactive_question");
      if (replyMessage.length <= 160 || hasInteractiveAction) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: replyMessage, actions: actionsStr },
        ]);
      } else {
        const words = replyMessage.split(" ");
        let currentWords = "";
        let wordIdx = 0;

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", actions: actionsStr },
        ]);

        const streamInterval = setInterval(() => {
          const chunk = words.slice(wordIdx, wordIdx + 4).join(" ");
          currentWords += (currentWords ? " " : "") + chunk;
          wordIdx += 4;

          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: currentWords,
              };
            }
            return updated;
          });

          if (wordIdx >= words.length) {
            clearInterval(streamInterval);
            setMessages((prev) => {
              const updated = [...prev];
              if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: replyMessage,
                };
              }
              return updated;
            });
          }
        }, 12);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "أهلاً بيك! جاري الاتصال بالمرشد الذكي 🌟 قولي إيه اللي محتاجه وسأساعدك فوراً!",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Strictly block and remove AI assistant on all exam, quiz, and homework pages
  const isExamOrHomework = [
    "/exam",
    "/exams",
    "/daily-exam",
    "/quiz",
    "/quizzes",
    "/homework",
    "/homeworks",
    "/wrong-questions",
  ].some((p) => pathname?.includes(p));

  // Admin & auth pages
  const isAuthOrAdmin = [
    "/adminpanel",
    "/login",
    "/signup",
    "/forgot-password",
    "/profile-setup",
  ].some((p) => pathname?.startsWith(p));

  // In lesson watch pages, hide the floating button so it doesn't overlap the video player or fullscreen button.
  // Instead, the dedicated button under the video triggers the assistant modal smoothly.
  const isWatchMode = pathname?.includes("/watch") || pathname?.includes("/learn");

  if (isAuthOrAdmin || isExamOrHomework || !aiEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Button (Hidden in watch mode to avoid blocking fullscreen and video controls) */}
      {!open && !isWatchMode && (
        <button
          onClick={() => {
            setMessages([WELCOME_MESSAGE]);
            setInput("");
            setSending(false);
            setUnread(false);
            setOpen(true);
          }}
          className="fixed bottom-[85px] lg:bottom-6 left-4 lg:left-6 z-50 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-[#009688] hover:bg-[#00897b] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 font-bold text-sm sm:text-base cursor-pointer border border-teal-400/30 group"
          aria-label="المساعد الذكي"
          dir="rtl"
        >
          <span>المساعد الذكي</span>
          <svg
            className="w-5 h-5 text-white shrink-0 group-hover:rotate-12 transition-transform"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            <path d="M19 15L20.1 18.1L23.2 19.2L20.1 20.3L19 23.4L17.9 20.3L14.8 19.2L17.9 18.1L19 15Z" />
          </svg>
          {unread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full ring-2 ring-white" />}
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-[80px] lg:bottom-6 left-4 right-4 sm:left-6 sm:right-auto z-50 sm:w-[420px] h-[75vh] sm:h-[600px] max-h-[calc(100vh-6rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-teal-200 dark:border-teal-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#009688] via-[#0d9488] to-[#00796b] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                  <path d="M19 15L20.1 18.1L23.2 19.2L20.1 20.3L19 23.4L17.9 20.3L14.8 19.2L17.9 18.1L19 15Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base">المساعد الذكي</h3>
                <p className="text-xs text-white/80">يعرف كل بياناتك ويساعدك</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm("هل تريد مسح الرسائل والمحادثات السابقة والحالية بالكامل؟")) {
                    try {
                      await fetch("/api/ai/chat", { method: "DELETE" });
                      setMessages([WELCOME_MESSAGE]);
                    } catch {
                      /* fallback clear */
                      setMessages([WELCOME_MESSAGE]);
                    }
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-red-500/40 text-xs font-medium transition-colors flex items-center gap-1 border border-white/20"
                title="مسح المحادثة وإعادة الضبط"
                aria-label="مسح المحادثة"
              >
                <span>🗑️</span>
                <span className="hidden sm:inline">إعادة ضبط</span>
              </button>
              <button
                onClick={() => { setOpen(false); setMessages([]); setInput(""); setSending(false); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="إغلاق"
              >✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50/70 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
            {messages.length === 0 && <div className="text-center text-slate-400 text-sm py-8">ابدأ الحوار...</div>}
            {messages.map((m, idx) => {
              let actions: ChatAction[] = m.actions ? (() => { try { return typeof m.actions === "string" ? JSON.parse(m.actions) : m.actions; } catch { return []; } })() : [];
              let cleanText = m.content.replace(/\[م:[^\]]+\]/g, "").trim();
              const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed && typeof parsed === "object") {
                    if (typeof parsed.message === "string") {
                      cleanText = parsed.message.replace(/\[م:[^\]]+\]/g, "").trim();
                    }
                    if (actions.length === 0 && Array.isArray(parsed.actions)) {
                      actions = parsed.actions;
                    }
                  }
                } catch {
                  // Keep as plain text
                }
              }
              const hasInteractiveAction = Array.isArray(actions) && actions.some((a) => a.type === "interactive_question");
              const autoParsed = !hasInteractiveAction && m.role === "assistant" ? parseTextChoices(cleanText) : null;
              const fallbackQuestion = !hasInteractiveAction && !autoParsed && m.role === "assistant" ? resolveFallbackQuestion(cleanText) : null;
              const displayText = autoParsed ? autoParsed.promptText : cleanText;
              const isAssistantWithInteractive = m.role === "assistant" && (hasInteractiveAction || Boolean(autoParsed) || Boolean(fallbackQuestion));

              return (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`${
                    isAssistantWithInteractive ? "w-full max-w-[96%]" : "max-w-[88%]"
                  } rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-br-sm shadow-md"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm shadow-sm border border-teal-100 dark:border-slate-700/60"
                  }`}>
                    {displayText && <FormattedText text={displayText} isUser={m.role === "user"} />}

                    {autoParsed && (
                      <div className="mt-3">
                        <InteractiveQuestionCard
                          payload={{
                            question: "",
                            options: autoParsed.options,
                          }}
                          onSendFollowup={(t) => void send(t)}
                        />
                      </div>
                    )}

                    {fallbackQuestion && (
                      <div className="mt-3">
                        <InteractiveQuestionCard
                          payload={fallbackQuestion}
                          onSendFollowup={(t) => void send(t)}
                        />
                      </div>
                    )}

                    {actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-teal-100/70 dark:border-slate-700/60 space-y-2">
                        {actions.map((a, ai) => <ActionBadge key={ai} action={a} router={router} onSendFollowup={(t) => void send(t)} />)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm border border-teal-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none border-t border-teal-100/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3.5 sm:p-4 border-t border-teal-100/70 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="اكتب رسالتك أو اطلب سؤالاً..."
                className="flex-1 rounded-2xl border border-teal-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                dir="rtl"
                disabled={sending}
              />
              <button
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer shadow-md"
                aria-label="إرسال"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FormattedText({ text, isUser }: { text: string; isUser?: boolean }) {
  if (!text) return null;

  // Split text by fenced code blocks: ```lang\ncode```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const sections: Array<{ type: "code" | "text"; content: string; lang?: string }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    sections.push({
      type: "code",
      lang: match[1] || "",
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    sections.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {sections.map((section, sIdx) => {
        if (section.type === "code") {
          return (
            <div
              key={sIdx}
              className="my-2 rounded-xl bg-slate-900 border border-slate-700/80 text-emerald-300 p-3 font-mono text-xs overflow-x-auto text-left"
              dir="ltr"
            >
              {section.lang && (
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  {section.lang}
                </div>
              )}
              <pre className="whitespace-pre">{section.content.trim()}</pre>
            </div>
          );
        }

        const lines = section.content.split("\n");
        return (
          <div key={sIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lIdx} className="h-1.5" />;
              }

              // Divider lines: ━━━━━━━━━━━━━━━━ or ---
              if (/^[━─—\-_=]{3,}$/.test(trimmed)) {
                return (
                  <hr
                    key={lIdx}
                    className={`my-2 border-t ${
                      isUser ? "border-white/25" : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                );
              }

              return (
                <div key={lIdx} className="break-words">
                  {renderInlineTokens(line, isUser)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineTokens(text: string, isUser?: boolean) {
  // Regex to match **bold**, *italic*, and `code`
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, pIdx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const content = part.slice(2, -2);
      return (
        <strong
          key={pIdx}
          className={`font-black ${
            isUser ? "text-white" : "text-teal-950 dark:text-teal-200"
          }`}
        >
          {content}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      const content = part.slice(1, -1);
      return (
        <em key={pIdx} className="italic opacity-90">
          {content}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const content = part.slice(1, -1);
      return (
        <code
          key={pIdx}
          className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${
            isUser
              ? "bg-white/20 text-white"
              : "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50"
          }`}
        >
          {content}
        </code>
      );
    }
    return <span key={pIdx}>{part}</span>;
  });
}

function parseTextChoices(text: string): { promptText: string; options: InteractiveQuestionOption[] } | null {
  if (!text || text.length < 15) return null;
  const lines = text.split("\n");
  const options: InteractiveQuestionOption[] = [];
  const promptLines: string[] = [];
  let foundOption = false;

  const optRegex = /^([أ-يa-zA-Z0-9]{1,2})[\s\)\-\.\]]+(.+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(optRegex);
    if (
      m &&
      m[2].trim().length > 0 &&
      !line.includes("http") &&
      !line.includes("www") &&
      !line.startsWith("•") &&
      !line.startsWith("1️⃣") &&
      !line.startsWith("2️⃣") &&
      !line.startsWith("3️⃣") &&
      !line.startsWith("4️⃣")
    ) {
      foundOption = true;
      options.push({
        id: m[1].replace(/[\)\-\.\]]/g, "").trim(),
        text: m[2].trim(),
      });
    } else {
      if (!foundOption) {
        promptLines.push(rawLine);
      }
    }
  }

  if (options.length >= 2) {
    return {
      promptText: promptLines.join("\n").trim(),
      options,
    };
  }
  return null;
}

function resolveFallbackQuestion(text: string): InteractiveQuestionPayload | null {
  if (!text || !text.includes("تحدي تدريبي")) return null;

  if (text.includes("مراحل تطور") || text.includes("الترتيب") || text.includes("1-1") || text.includes("تكنولوجيا المعلومات")) {
    return {
      questionId: "q_it_timeline",
      topic: "الدرس 1-1: مراحل تطور تكنولوجيا المعلومات",
      question: "ما الترتيب الزمني الصحيح لمراحل تطور تكنولوجيا المعلومات (IT)؟",
      options: [
        { id: "A", text: "بداية ظهور الحاسب ➔ تسويق الإنترنت تجارياً ➔ ظهور الهواتف الذكية ➔ انتشار الحوسبة السحابية" },
        { id: "B", text: "بداية ظهور الحاسب ➔ ظهور الهواتف الذكية ➔ تسويق الإنترنت تجارياً ➔ انتشار الحوسبة السحابية" },
        { id: "C", text: "ظهور الهواتف الذكية ➔ تسويق الإنترنت تجارياً ➔ ظهور الحاسب ➔ انتشار الحوسبة السحابية" },
        { id: "D", text: "تسويق الإنترنت تجارياً ➔ بداية ظهور الحاسب ➔ انتشار الحوسبة السحابية ➔ ظهور الهواتف الذكية" },
      ],
      correctAnswer: "A",
      explanation: "الترتيب التاريخي الدقيق لتطور تكنولوجيا المعلومات (IT) وفقاً للمنهج: 1. بداية ظهور الحواسيب (1940s-1970s)، 2. تسويق الإنترنت تجارياً في التسعينيات (1990s)، 3. ثورة الهواتف الذكية (2000s)، 4. انتشار الحوسبة السحابية والخدمات الرقمية.",
      difficulty: "medium",
    };
  }

  if (text.includes("قانون مور") || text.includes("moore")) {
    return {
      questionId: "q_it_2",
      topic: "الدرس 1-1: تطور تكنولوجيا المعلومات",
      question: "ينص «قانون مور» (Moore's Law) الشهير الذي صاغه جوردون مور على أن:",
      options: [
        { id: "A", text: "حجم ذاكرة الوصول العشوائي يتضاعف كل 6 أشهر" },
        { id: "B", text: "عدد الترانزستورات على شريحة المعالج يتضاعف كل سنتين تقريباً مع انخفاض التكلفة" },
        { id: "C", text: "سرعة الإنترنت تتضاعف سنوياً دون زيادة الأسعار" },
        { id: "D", text: "استهلاك الطاقة يقل للنصف كل 10 سنوات" },
      ],
      correctAnswer: "B",
      explanation: "توقع جوردون مور عام 1965 أن كثافة الترانزستورات على شريحة السيليكون تتضاعف تقريباً كل عامين مع انخفاض تكلفتها.",
      difficulty: "medium",
    };
  }

  return {
    questionId: "q_it_1",
    topic: "الدرس 1-1: تطور تكنولوجيا المعلومات",
    question: "ما هو المكون الإلكتروني الرئيسي الذي ميّز الجيل الأول من الحواسيب مثل حاسوب (ENIAC) في أربعينيات القرن الماضي؟",
    options: [
      { id: "A", text: "الصمامات المفرغة (Vacuum Tubes)" },
      { id: "B", text: "الترانزستورات (Transistors)" },
      { id: "C", text: "الدوائر المتكاملة (Integrated Circuits)" },
      { id: "D", text: "المعالجات الدقيقة (Microprocessors)" },
    ],
    correctAnswer: "A",
    explanation: "اعتمد الجيل الأول (مثل حاسوب ENIAC) على الصمامات المفرغة الزجاجية للتحكم في تدفق الإلكترونات، وكانت ضخمة وتولد حرارة هائلة وتستهلك طاقة كبيرة.",
    difficulty: "easy",
  };
}

function ActionBadge({
  action,
  router,
  onSendFollowup,
}: {
  action: ChatAction;
  router: ReturnType<typeof useRouter>;
  onSendFollowup?: (text: string) => void;
}) {
  if (!action || action.type === "none") return null;

  // 1. Interactive Question Action
  if (action.type === "interactive_question") {
    let payload = action.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { /* ignore */ }
    }
    if (payload) {
      return <InteractiveQuestionCard payload={payload as InteractiveQuestionPayload} onSendFollowup={onSendFollowup} />;
    }
  }

  // 2. Navigation Action
  const isNav = action.type === "navigate";
  const path = (action as any)?.payload?.path || (action as any)?.path || action.id;
  const reason = (action as any)?.payload?.reason || (action as any)?.reason;

  if (isNav && path) {
    return (
      <button
        onClick={() => router.push(path)}
        className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-md transition-all font-bold cursor-pointer my-1.5 active:scale-95 w-full sm:w-auto justify-center"
      >
        <span>🚀 {reason || "اضغط هنا للانتقال فوراً"}</span>
      </button>
    );
  }

  if (action.status === "success" || action.status === "created" || action.status === "error" || action.status === "failed") {
    const isErr = action.status === "error" || action.status === "failed";
    return (
      <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
        isErr ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
      }`}>
        <span>{isErr ? "❌" : "✅"}</span>
        <span>{action.error || (action.status === "created" ? "تم التنفيذ بنجاح" : action.status)}</span>
      </div>
    );
  }

  return null;
}

function InteractiveQuestionCard({
  payload,
  onSendFollowup,
}: {
  payload: InteractiveQuestionPayload;
  onSendFollowup?: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!payload || !Array.isArray(payload.options) || payload.options.length === 0) {
    return null;
  }

  const hasAnswer = Boolean(payload.correctAnswer);
  const isCorrect = hasAnswer && selected === payload.correctAnswer;

  const handleSelect = (opt: InteractiveQuestionOption) => {
    if (isSubmitted) return;
    setSelected(opt.id);
    setIsSubmitted(true);

    // If card does not have pre-baked correctAnswer (e.g. auto-parsed from text), forward to AI!
    if (!hasAnswer && onSendFollowup) {
      onSendFollowup(`إجابتي هي (${opt.id}): ${opt.text}`);
    }
  };

  return (
    <div className="my-2 p-3.5 sm:p-4 rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-xl text-right w-full" dir="rtl">
      {/* Badge / Topic Header */}
      {payload.topic && (
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-400/15 text-teal-300 border border-teal-400/30">
              <span>🎯</span>
              <span>{payload.topic}</span>
            </span>
          </div>
          {payload.difficulty && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              payload.difficulty === "easy" ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30" :
              payload.difficulty === "medium" ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" :
              "bg-rose-400/15 text-rose-300 border border-rose-400/30"
            }`}>
              {payload.difficulty === "easy" ? "مستوى سهل" : payload.difficulty === "medium" ? "مستوى متوسط" : "مستوى متقدم 🔥"}
            </span>
          )}
        </div>
      )}

      {/* Question Text */}
      {payload.question && (
        <div className="text-white leading-relaxed mb-3 text-xs sm:text-sm font-bold">
          <FormattedText text={payload.question} isUser={false} />
        </div>
      )}

      {/* Responsive Clickable Option Buttons */}
      <div className="grid grid-cols-1 gap-2 mb-2.5">
        {payload.options.map((opt) => {
          const isSelectedOpt = selected === opt.id;
          const isCorrectOpt = hasAnswer && opt.id === payload.correctAnswer;

          let btnStyle = "border-slate-700/80 bg-slate-950/70 text-slate-200 hover:border-teal-400/70 hover:bg-teal-500/10 hover:shadow-md";

          if (isSubmitted) {
            if (hasAnswer) {
              if (isCorrectOpt) {
                btnStyle = "border-emerald-400 bg-emerald-500/25 text-emerald-100 font-bold ring-2 ring-emerald-400/40 shadow-md";
              } else if (isSelectedOpt && !isCorrect) {
                btnStyle = "border-rose-400 bg-rose-500/20 text-rose-100 line-through opacity-90";
              } else {
                btnStyle = "border-slate-800 bg-slate-950/40 text-slate-500 opacity-40";
              }
            } else {
              if (isSelectedOpt) {
                btnStyle = "border-teal-400 bg-teal-500/20 text-teal-100 font-bold ring-2 ring-teal-400/30 shadow-md";
              } else {
                btnStyle = "border-slate-800 bg-slate-950/40 text-slate-500 opacity-40";
              }
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={isSubmitted}
              className={`min-h-[46px] rounded-xl border px-3 py-2.5 text-right text-xs sm:text-sm font-semibold leading-snug transition-all duration-200 flex items-center justify-between gap-2.5 active:scale-[0.98] cursor-pointer ${btnStyle}`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black shrink-0 transition-colors ${
                  isSubmitted && isCorrectOpt
                    ? "bg-emerald-500 text-white shadow-sm"
                    : isSubmitted && isSelectedOpt && !isCorrect
                    ? "bg-rose-500 text-white"
                    : isSubmitted && isSelectedOpt && !hasAnswer
                    ? "bg-teal-500 text-white"
                    : "bg-white/10 text-slate-200"
                }`}>
                  {opt.id}
                </span>
                <span className="leading-relaxed break-words flex-1">{opt.text}</span>
              </div>
              {isSubmitted && isCorrectOpt && <span className="text-emerald-400 font-bold text-sm shrink-0">✅</span>}
              {isSubmitted && isSelectedOpt && !isCorrect && hasAnswer && <span className="text-rose-400 font-bold text-sm shrink-0">❌</span>}
              {isSubmitted && isSelectedOpt && !hasAnswer && <span className="text-teal-400 font-bold text-sm shrink-0">🚀</span>}
            </button>
          );
        })}
      </div>

      {/* Real Answer & Explanation Drawer */}
      {isSubmitted && (
        <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all shadow-sm ${
          hasAnswer
            ? isCorrect
              ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-100"
              : "bg-amber-400/10 border-amber-400/30 text-amber-100"
            : "bg-teal-400/10 border-teal-400/30 text-teal-100"
        }`}>
          {hasAnswer ? (
            <>
              <div className="font-black flex items-center gap-1.5 mb-1.5 text-xs sm:text-sm">
                <span>{isCorrect ? "🎉 إجابة صحيحة وممتازة! ✓" : `❌ إجابة غير صحيحة — الإجابة الصحيحة هي: (${payload.correctAnswer})`}</span>
              </div>
              {payload.explanation && (
                <>
                  <div className="font-bold mb-1 opacity-90 text-[11px] text-teal-200">💡 التفسير والشرح النموذجي:</div>
                  <div className="opacity-95 font-normal leading-relaxed text-xs text-slate-200">
                    <FormattedText text={payload.explanation} isUser={false} />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="font-bold flex items-center gap-2 text-teal-200">
              <span>🚀 تم تسجيل إجابتك ({selected}) — جاري الفحص والمتابعة مع المعلم الذكي...</span>
            </div>
          )}

          {/* Followup triggers */}
          {hasAnswer && onSendFollowup && (
            <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onSendFollowup(`اسألني سؤال تاني في ${payload.topic || "نفس الموضوع"}`)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>🔄</span>
                  <span>سؤال آخر في نفس الدرس</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendFollowup("اسألني سؤال في موضوع تاني")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>🎲</span>
                  <span>سؤال في موضوع مختلف</span>
                </button>
              </div>

              {/* Ask Assistant about concept button */}
              <button
                type="button"
                onClick={() => onSendFollowup(`اشرح لي بالتفصيل مفهوم «${payload.topic || "هذا الدرس"}». ${payload.question || ""}`)}
                className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-200 font-bold text-[11px] transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span>💡</span>
                <span>اسأل المساعد عن المفهوم</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Standalone concept help button before answering */}
      {!isSubmitted && onSendFollowup && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onSendFollowup(`اشرح لي بالتفصيل مفهوم «${payload.topic || "هذا الدرس"}» ولا تعطيني الإجابة مباشرة. ${payload.question || ""}`)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-200 font-bold text-[11px] transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>💡</span>
            <span>اسأل المساعد عن المفهوم</span>
          </button>
        </div>
      )}
    </div>
  );
}
