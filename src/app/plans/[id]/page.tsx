"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useToast } from "@/components/ui/Toast";

type PlanLessonPreview = {
  id: string;
  title: string;
  order: number;
  requiresQuiz: boolean;
  requiresHomework: boolean;
  hasProject: boolean;
};

type PlanPreview = {
  id: string;
  title: string;
  educationalStage: string;
  description?: string | null;
  price: number;
  discountPrice: number | null;
  discountExpiresAt: string | null;
  effectivePrice: number;
  totalLessons: number;
  lessons: PlanLessonPreview[];
  hasAccess: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  sec_1: "أولى بكالوريا",
  sec_2: "ثانية بكالوريا",
};

export default function PlanProductPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [user, setUser] = useState<{ name: string; role: string; phone?: string | null } | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [payMode, setPayMode] = useState<"balance" | "wallet" | "whatsapp" | "code">("wallet");
  const [walletPhone, setWalletPhone] = useState("");
  const [selectedWalletMethod, setSelectedWalletMethod] = useState<"vf_cash" | "or_cash" | "et_cash">("vf_cash");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMsg, setWalletMsg] = useState("");
  const [walletModal, setWalletModal] = useState<{ reference: string; instructions: string; methodLabel: string; amount: number } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => { const raw = await r.text(); return raw ? JSON.parse(raw) : {}; })
      .then((d) => setUser(d.user ? { name: d.user.name, role: d.user.role, phone: d.user.phone ?? null } : null))
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  const loadPreview = async () => {
    if (!planId) return;
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/plans/${planId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.plan?.hasAccess) {
          router.replace(`/plans/${planId}/learn`);
          return;
        }
        setPlan(data.plan);
      } else if (res.status === 404) {
        setPlan(null);
      } else {
        setFetchError("حدث خطأ أثناء تحميل الخطة، حاول مرة أخرى");
      }
    } catch {
      setFetchError("تعذر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPreview();
  }, [planId]);

  const purchasePlan = async () => {
    if (!user) { router.push(`/login?redirect_url=/plans/${planId}`); return; }
    setPurchasing(true);
    try {
      const res = await fetch(`/api/plans/${planId}/purchase`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toastSuccess(data.message || "تم الشراء بنجاح!");
        router.push("/library");
      } else if (data.code === "INSUFFICIENT_FUNDS") {
        // Not enough balance → send the student to the Payment page to top up,
        // then they get returned here automatically after a successful payment.
        const price = typeof data.effectivePrice === "number" ? data.effectivePrice : 0;
        router.push(`/payment?amount=${price}&return=${encodeURIComponent(`/plans/${planId}`)}&context=${encodeURIComponent(`شراء خطة — ${price} جنيه`)}`);
      } else {
        toastError(data.error || "تعذر إتمام الشراء");
      }
    } catch {
      toastError("حدث خطأ أثناء الشراء");
    } finally {
      setPurchasing(false);
    }
  };

  const applyCode = async () => {
    if (!code.trim()) return;
    if (!user) { router.push("/login"); return; }
    setApplying(true);
    const res = await fetch("/api/codes", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
    const data = await res.json();
    setApplying(false);
    if (res.ok) {
      toastSuccess(data.message || "تم تفعيل الكود بنجاح! جارٍ الدخول...");
      router.push("/library");
    } else if (res.status === 401) {
      router.push("/login");
    } else {
      toastError(data.error || "كود غير صحيح أو منتهي الصلاحية");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar user={user} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-lg">جارٍ التحميل...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar user={user} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">⚠️</p>
            <p className="text-base text-gray-700 dark:text-gray-300">{fetchError}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={loadPreview} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">إعادة المحاولة</button>
              <button onClick={() => router.push("/plans")} className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium">العودة للخطط</button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar user={user} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-3">الخطة غير موجودة</p>
            <button onClick={() => router.push("/plans")} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">العودة للخطط</button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950" dir="rtl">
      <Navbar user={user} />

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/15">
                {STAGE_LABELS[plan.educationalStage] || plan.educationalStage}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 font-bold">
                خطة دراسية
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4">{plan.title}</h1>
            {plan.description && (() => {
              let points: string[] = [];
              try {
                if (plan.description.startsWith('[') && plan.description.endsWith(']')) {
                  points = JSON.parse(plan.description);
                } else {
                  points = plan.description.split('\n').filter(Boolean);
                }
              } catch {
                points = plan.description.split('\n').filter(Boolean);
              }
              if (points.length === 1 && points[0] === plan.description) {
                return <p className="text-white/80 text-base leading-relaxed mb-6">{plan.description}</p>;
              }
              return (
                <ul className="list-disc list-inside space-y-2 text-white/90 text-sm md:text-base mb-6 text-right max-w-xl">
                  {points.map((p, i) => (
                    <li key={i} className="leading-relaxed">{p}</li>
                  ))}
                </ul>
              );
            })()}
            <div className="flex flex-wrap gap-4 text-sm text-white/70">
              <span>📚 {plan.totalLessons} درس متسلسل</span>
              <span>✅ متابعة مستمرة</span>
              <span>🤖 تقييم بالذكاء الاصطناعي</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: content overview */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">مسار الخطة</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{plan.totalLessons} درس</p>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {plan.lessons.map((lesson, idx) => (
                  <li key={lesson.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{lesson.title}</p>
                        <div className="flex gap-2 mt-1">
                          {lesson.requiresQuiz && <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 rounded">اختبار</span>}
                          {lesson.requiresHomework && <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 rounded">واجب</span>}
                          {lesson.hasProject && <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 rounded">مشروع AI</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: pricing card */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
              <div className="p-6 space-y-5">
                {/* Price display */}
                {plan.effectivePrice === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">مجاني</span>
                  </div>
                ) : plan.discountPrice !== null ? (
                  <div className="space-y-1">
                    <div className="flex items-end gap-3">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.effectivePrice} جنيه</span>
                      <span className="text-lg text-gray-400 line-through mb-0.5">{plan.price} جنيه</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price} جنيه</span>
                  </div>
                )}

                {/* CTA */}
                {plan.hasAccess ? (
                  <button
                    onClick={() => router.push(`/plans/${plan.id}/learn`)}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-colors"
                  >
                    متابعة الخطة ←
                  </button>
                ) : plan.effectivePrice === 0 ? (
                  <div className="space-y-3">
                    <button
                      onClick={purchasePlan}
                      disabled={purchasing || userLoading}
                      className="w-full py-3 rounded-xl text-white font-bold text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-lg bg-indigo-600 hover:bg-indigo-700"
                    >
                      {purchasing ? "جارٍ التثبيت..." : "تثبيت الخطة مجانًا"}
                    </button>
                    {!userLoading && !user && (
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                        يلزم <button onClick={() => router.push(`/login?redirect_url=/plans/${planId}`)} className="text-indigo-600 underline">تسجيل الدخول</button> أولاً
                      </p>
                    )}
                  </div>
                ) : (
                  /* Paid plan — wallet / balance / whatsapp / code choices */
                  <div className="space-y-3">
                    {/* Pay mode toggle */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <button onClick={() => setPayMode("wallet")}
                        className="rounded-lg text-xs font-bold border-none cursor-pointer transition-colors py-2"
                        style={{ background: payMode === "wallet" ? "var(--brand)" : "transparent", color: payMode === "wallet" ? "#fff" : "var(--ink-3)" }}>
                        📱 محفظة إلكترونية
                      </button>
                      <button onClick={() => setPayMode("balance")}
                        className="rounded-lg text-xs font-bold border-none cursor-pointer transition-colors py-2"
                        style={{ background: payMode === "balance" ? "var(--gold-2)" : "transparent", color: payMode === "balance" ? "#fff" : "var(--ink-3)" }}>
                        💰 شراء بالرصيد
                      </button>
                      <button onClick={() => setPayMode("whatsapp")}
                        className="rounded-lg text-xs font-bold border-none cursor-pointer transition-colors py-2"
                        style={{ background: payMode === "whatsapp" ? "#25D366" : "transparent", color: payMode === "whatsapp" ? "#fff" : "var(--ink-3)" }}>
                        💬 طُرق أخرى (واتسآب)
                      </button>
                      <button onClick={() => setPayMode("code")}
                        className="rounded-lg text-xs font-bold border-none cursor-pointer transition-colors py-2"
                        style={{ background: payMode === "code" ? "var(--ink-2)" : "transparent", color: payMode === "code" ? "#fff" : "var(--ink-3)" }}>
                        🔑 كود تفعيل
                      </button>
                    </div>

                    {/* Mode 1: Mobile Wallet via Sha7nawy — redirects to the unified Payment page */}
                    {payMode === "wallet" && (
                      <div className="p-3.5 rounded-xl space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <p className="text-xs text-center leading-relaxed" style={{ color: "var(--ink-2)" }}>
                          سيتم تحويلك لصفحة الدفع الموحّدة لاختيار طريقة الدفع المناسبة (فوري، كروت البنك، فودافون كاش، أورانج كاش) وإتمام العملية بأمان.
                        </p>
                        <button onClick={() => {
                          if (!user) { router.push(`/login?redirect_url=/plans/${planId}`); return; }
                          router.push(`/payment?amount=${plan.effectivePrice}&return=${encodeURIComponent(`/plans/${planId}`)}&context=${encodeURIComponent(`شراء خطة — ${plan.effectivePrice} جنيه`)}`);
                        }} disabled={userLoading}
                          className="w-full py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
                          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-strong))" }}>
                          الدفع عبر المحفظة 📱
                        </button>
                      </div>
                    )}

                    {/* Mode 2: Balance Purchase */}
                    {payMode === "balance" && (
                      <>
                        <button onClick={purchasePlan} disabled={purchasing || userLoading}
                          className="w-full py-3 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-60 hover:opacity-90"
                          style={{ background: "linear-gradient(135deg,var(--gold-2),#9a6a1c)" }}>
                          {purchasing ? "جارٍ الشراء..." : `شراء بـ ${plan.effectivePrice} جنيه`}
                        </button>
                        {!user && <p className="text-xs text-center text-gray-500"><button onClick={() => router.push(`/login?redirect_url=/plans/${planId}`)} className="text-indigo-600 underline">سجّل الدخول</button> أولاً</p>}
                      </>
                    )}

                    {/* Mode 3: WhatsApp Assistance */}
                    {payMode === "whatsapp" && (
                      <div className="space-y-2 text-center">
                        <p className="text-xs text-gray-500 font-medium">تواصل معنا لشراء الخطة عبر InstaPay، التحويل البنكي، أو الكاش:</p>
                        <a href={`https://wa.me/${(process.env.NEXT_PUBLIC_PAYMENT_ACCESS_PASSWORD || "+201285353604").replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً، أريد الاشتراك في خطة "${plan.title}" بسعر ${plan.effectivePrice} جنيه. اسم الطالب: ${user?.name || "غير مسجل"}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold text-sm transition-colors hover:opacity-90 no-underline"
                          style={{ background: "#25D366" }}>
                          💬 تواصل للشراء عبر واتسآب
                        </a>
                      </div>
                    )}

                    {/* Mode 4: Access Code */}
                    {payMode === "code" && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600 text-center">أدخل كود الاشتراك الخاص بالخطة:</p>
                        <div className="flex gap-2">
                          <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === "Enter" && applyCode()} placeholder="كود الوصول" maxLength={16} dir="ltr"
                            className="flex-1 rounded-xl px-3 py-2.5 text-center font-mono text-sm tracking-widest focus:outline-none border border-gray-200" />
                          <button onClick={applyCode} disabled={applying || !code.trim()}
                            className="rounded-xl px-4 py-2.5 text-white font-bold text-sm bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {applying ? "..." : "تفعيل"}
                          </button>
                        </div>
                        {!user && <p className="text-xs text-center text-gray-500"><button onClick={() => router.push("/login")} className="text-indigo-600 underline">سجّل الدخول</button> أولاً</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Sha7nawy Instruction Modal */}
                {walletModal && (
                  <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)" }} onClick={() => setWalletModal(null)}>
                    <div className="w-full max-w-md rounded-2xl p-6 text-center space-y-4 shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
                      <div className="text-4xl">📲</div>
                      <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>تم إرسال طلب الخصم بنجاح!</h3>
                      <p className="text-xs text-gray-500 font-mono">رقم المرجع: {walletModal.reference}</p>
                      
                      <div className="p-4 rounded-xl space-y-2 text-right text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <p className="font-bold text-center" style={{ color: "var(--brand)" }}>تعليمات إتمام العملية:</p>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>{walletModal.instructions}</p>
                      </div>

                      <div className="pt-2 space-y-2">
                        <button onClick={async () => {
                          setWalletLoading(true);
                          try {
                            const res = await fetch("/api/payments/sha7nawy/confirm", {
                              method: "POST", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ref_code: walletModal.reference }),
                            });
                            const d = await res.json().catch(() => ({}));
                            setWalletLoading(false);
                            if (res.ok && d.success) {
                              setWalletModal(null);
                              toastSuccess("تم تأكيد السحب وشحن حسابك بنجاح!");
                            } else {
                              setWalletMsg(`⚠️ ${d.error || "العملية معلقة بانتظار موافقة العميل من المحفظة"}`);
                            }
                          } catch {
                            setWalletLoading(false);
                            setWalletMsg("❌ تعذر الاتصال بسيرفر التأكيد");
                          }
                        }} disabled={walletLoading}
                          className="w-full py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all hover:opacity-90 shadow-md"
                          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-strong))" }}>
                          {walletLoading ? "جارٍ التحقق والتأكيد..." : "تأكيد واستعلام حالة الدفع 🔄"}
                        </button>

                        <button onClick={() => setWalletModal(null)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-2)" }}>
                          إغلاق النافذة
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
