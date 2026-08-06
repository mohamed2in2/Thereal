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
  const router  = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [unread, setUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /*
   * Auth check — lazy & cached.
   * 1. Try sessionStorage cache first (0 network requests if hit).
   * 2. If cache miss, wait 1.5s after mount so it doesn't race with critical
   *    page requests (LCP data, course API, etc.), then fetch.
   * 3. Result is cached for 10 minutes in sessionStorage.
   */
  useEffect(() => {
    const cached = readAuthCache();
    if (cached) {
      setIsStudent(cached.isStudent);
      setAiEnabled(cached.aiEnabled);
      setAuthChecked(true);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [auth, status] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).catch(() => null),
          fetch("/api/ai/status").then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        const student = auth?.user?.role === "student";
        const enabled = status?.enabled === true;
        setIsStudent(student);
        setAiEnabled(enabled);
        writeAuthCache(student, enabled);
      } catch { /* non-critical */ } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }, 1500); // 1.5s defer — lets critical page fetches land first

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: replyMessage,
          actions: data?.actions ? JSON.stringify(data.actions) : null,
        },
      ]);
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

  const hideOn = ["/adminpanel", "/login", "/signup", "/forgot-password", "/profile-setup"];
  const shouldHide = hideOn.some((p) => pathname?.startsWith(p));

  if (!authChecked || !isStudent || !aiEnabled || shouldHide) return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
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
              const actions: ChatAction[] = m.actions ? (() => { try { return JSON.parse(m.actions!); } catch { return []; } })() : [];
              return (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white rounded-br-sm shadow-md"
                      : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-sm border border-purple-100 dark:border-purple-900/40"
                  }`}>
                    {m.content}
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
  const color =
    action.status === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
    : action.status === "error"   ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
    : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  const icon =
    action.status === "success" ? "✓"
    : action.status === "error"   ? "✗"
    : action.type === "navigate"  ? "→"
    : "⟳";

  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="font-bold">{icon}</span>
      <span>
        {action.type === "navigate" && action.id ? (
          <button onClick={() => router.push(action.id!)} className="underline underline-offset-2">
            {action.status === "success" ? "انتقل للكورس" : action.status}
          </button>
        ) : action.status}
      </span>
    </div>
  );
}
