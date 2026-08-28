"use client";
import { useState, useEffect, useRef } from "react";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: Array<{
    type: string;
    status?: string;
    path?: string;
    reason?: string;
    payload?: { path?: string; reason?: string };
    error?: string;
  }>;
}

export default function AIStudyPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userRes, chatRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/ai/chat", { credentials: "include" }),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user || null);
        }

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.messages && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
            setMessages(chatData.messages);
          }
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      } finally {
        setInitialLoad(false);
      }
    };

    void fetchInitialData();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          actions: data.actions,
        };
        setMessages((prev) => [...prev, aiMessage]);

        if (Array.isArray(data?.actions)) {
          for (const act of data.actions) {
            const navPath = act?.payload?.path || act?.path;
            if (act.type === "navigate" && navPath) {
              const lowerMsg = userMessage.content.toLowerCase();
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
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfileGuard>
      <div className="flex flex-col h-screen max-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0B0F19] transition-colors duration-300 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <Navbar user={user} />
        
        <main className="flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex flex-col relative z-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/40">💡</span>
                المرشد الدراسي
              </h1>
              <p className="text-gray-500 dark:text-gray-400">رفيقك الشخصي لمساعدتك في فهم المواد وحل الأسئلة</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (confirm("هل تريد مسح جميع الرسائل السابقة والحالية؟")) {
                    try {
                      await fetch("/api/ai/chat", { method: "DELETE" });
                      setMessages([]);
                    } catch {
                      setMessages([]);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-xs font-semibold"
                title="مسح المحادثة"
              >
                🗑️ مسح المحادثة
              </button>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#151B2B] border border-gray-100 dark:border-gray-800 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">متصل الآن</span>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-[#151B2B] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col">
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
              {initialLoad ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center text-4xl mb-6">
                    👋
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">أهلاً بك يا {user?.name ? user.name.split(' ')[0] : 'بطل'}!</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
                    أنا مرشدك الدراسي هنا. جاهز نراجع أي جزء مش واضح في الكورس أو نحل مع بعض أسئلة صعبة؟
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={() => setInput("اشرح لي مفهوم المتغيرات في البرمجة")} className="px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      اشرح لي مفهوم المتغيرات
                    </button>
                    <button onClick={() => setInput("كيف أستعد للاختبار القادم؟")} className="px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      كيف أستعد للاختبار القادم؟
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-4">
                  {messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"}`}
                    >
                      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${
                        msg.role === "user" 
                          ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white" 
                          : "bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-purple-500/30"
                      }`}>
                        {msg.role === "user" ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        ) : (
                          "💡"
                        )}
                      </div>
                      <div className={`p-4 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-sm shadow-md"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm"
                      }`}>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                        {Array.isArray(msg.actions) && msg.actions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                            {msg.actions.map((act, idx) => {
                              const navPath = act?.payload?.path || act?.path;
                              const navReason = act?.payload?.reason || act?.reason || "انتقال فوري";
                              if (act.type === "navigate" && navPath) {
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => router.push(navPath)}
                                    className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold shadow-md transition-all cursor-pointer"
                                  >
                                    <span>🚀 {navReason}</span>
                                  </button>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-4 max-w-[85%] ml-auto"
                    >
                      <div className="w-10 h-10 rounded-xl shrink-0 bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/30">
                        💡
                      </div>
                      <div className="p-4 rounded-2xl rounded-tl-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <form onSubmit={handleSend} className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="اسألني أي شيء..."
                  className="flex-1 bg-white dark:bg-[#151B2B] text-gray-900 dark:text-white rounded-2xl pl-24 pr-4 py-4 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow shadow-sm"
                  disabled={loading || initialLoad}
                />
                <div className="absolute left-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm("هل تريد مسح جميع الرسائل السابقة والحالية؟")) {
                        try {
                          await fetch("/api/ai/chat", { method: "DELETE" });
                          setMessages([]);
                        } catch {
                          setMessages([]);
                        }
                      }
                    }}
                    title="مسح المحادثة وإعادة الضبط"
                    className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    🗑️
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || loading || initialLoad}
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                  >
                    <svg className="w-5 h-5 transform -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              <div className="text-center mt-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  الإجابات مقدمة كنقطة انطلاق لمساعدتك. يُنصح دائماً بالرجوع لمصادر الكورس والمدرس.
                </span>
              </div>
            </div>
          </div>
        </main>
        
        {/* We keep Footer hidden on this specific page to maximize chat height, but it's technically in the layout. */}
        {/* Actually, let's include it but keep the main height flexible. We changed h-[calc] to min-h */}
      </div>
    </ProfileGuard>
  );
}
