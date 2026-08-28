"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

interface ChatAction {
  type: string;
  status: string;
  id?: string;
  error?: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: string | null;
  createdAt?: string;
}

const QUICK_PROMPTS = [
  "حلل أدائي وقولي نقاط ضعفي",
  "اعمللي خطة تدريبية للأسبوع",
  "في إجابة في كويز اتسجلت غلط",
  "مش مرتاح من شرح مدرس معين",
  "أنا بآخد كورس مع حد تاني، اعمللي خطة بديلة",
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
      const replyMessage = data?.message || data?.error || "أهلاً بيك! أنا مرشدك الذكي 🌟 قولي إيه اللي محتاجه وسيتم مساعدتك فوراً!";
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

      // Smooth fast stream rendering for instant perceived response
      if (replyMessage.length <= 80) {
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
          const chunk = words.slice(wordIdx, wordIdx + 3).join(" ");
          currentWords += (currentWords ? " " : "") + chunk;
          wordIdx += 3;

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
        }, 20);
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50/40 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
            {messages.length === 0 && <div className="text-center text-gray-400 text-sm py-8">ابدأ الحوار...</div>}
            {messages.map((m, idx) => {
              let actions: ChatAction[] = m.actions ? (() => { try { return JSON.parse(m.actions!); } catch { return []; } })() : [];
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
              return (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white rounded-br-sm shadow-md"
                      : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-sm border border-purple-100 dark:border-purple-900/40"
                  }`}>
                    {cleanText}
                    {actions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800/40 space-y-1">
                        {actions.map((a, ai) => <ActionBadge key={ai} action={a} router={router} />)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm border border-purple-100 dark:border-purple-900/40">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none border-t border-purple-100 dark:border-purple-900/30">
              {QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => send(p)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors whitespace-nowrap">
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-purple-100 dark:border-purple-900/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="اكتب رسالتك..."
                className="flex-1 rounded-2xl border border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-slate-800 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                dir="rtl"
                disabled={sending}
              />
              <button
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100"
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

function ActionBadge({ action, router }: { action: ChatAction; router: ReturnType<typeof useRouter> }) {
  if (!action || action.type === "none") return null;

  const isNav = action.type === "navigate";
  const path = (action as any)?.payload?.path || (action as any)?.path || action.id;
  const reason = (action as any)?.payload?.reason || (action as any)?.reason;

  if (isNav && path) {
    return (
      <button
        onClick={() => router.push(path)}
        className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md transition-all font-bold cursor-pointer my-1.5 active:scale-95"
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
