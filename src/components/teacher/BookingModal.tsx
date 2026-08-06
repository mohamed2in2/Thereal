"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface BookingPlan {
  type: "monthly" | "termly" | "yearly";
  label: string;
  sublabel: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  icon: string;
  accent: string;
  accentBg: string;
}

interface BookingModalProps {
  teacherId?: string;
  priceMonthly: number | null;
  priceTermly: number | null;
  priceYearly: number | null;
  discountMonthly?: number | null;
  discountTermly?: number | null;
  discountYearly?: number | null;
  courseStartDate: string | null;
  bookingContactUrl: string | null;
  accentColor: string;
  teacherName: string;
}

const STAGE_OPTIONS = [
  { value: "sec_1", label: "أولى بكالوريا" },
  { value: "sec_2", label: "ثانية بكالوريا" },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function formatArabicDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function buildWhatsAppUrl(
  contactUrl: string | null,
  studentName: string,
  gradeLabel: string,
  plan: BookingPlan,
  teacherName: string,
  startDateStr: string | null
): string {
  let rawNumber = contactUrl ? contactUrl.trim() : "";
  if (rawNumber.startsWith("http")) {
    try {
      const u = new URL(rawNumber);
      rawNumber = u.pathname.replace(/\//g, "") || rawNumber;
    } catch {}
  }
  rawNumber = rawNumber.replace(/[^\d+]/g, "");
  if (rawNumber.startsWith("0")) {
    rawNumber = "2" + rawNumber;
  }
  if (rawNumber && !rawNumber.startsWith("+") && !rawNumber.startsWith("2")) {
    rawNumber = "20" + rawNumber;
  }
  rawNumber = rawNumber.replace("+", "");

  const startDateFormatted = startDateStr ? formatArabicDate(startDateStr) : "";

  let msg = `السلام عليكم أستاذ ${teacherName} 👋\n`;
  if (studentName) msg += `👤 اسم الطالب: ${studentName}\n`;
  if (gradeLabel) msg += `📚 الصف الدراسي: ${gradeLabel}\n`;

  if (plan.discountPercent && plan.originalPrice) {
    msg += `💳 خطة الاشتراك المطلوبة: ${plan.label} (خصم ${plan.discountPercent}% 🔥 - بسعر ${plan.price} جنيه بدلاً من ${plan.originalPrice} جنيه)\n`;
  } else {
    msg += `💳 خطة الاشتراك المطلوبة: ${plan.label} (${plan.price} جنيه)\n`;
  }

  if (startDateFormatted) msg += `📅 تاريخ بدء الكورس: ${startDateFormatted}\n`;
  msg += `\nأود الاشتراك ومتابعة خطوات التسجيل والتفعيل. شكراً لك!`;

  const encodedMsg = encodeURIComponent(msg);

  if (rawNumber) {
    return `https://wa.me/${rawNumber}?text=${encodedMsg}`;
  }
  return `https://wa.me/?text=${encodedMsg}`;
}

export function BookingButton({
  teacherId,
  priceMonthly,
  priceTermly,
  priceYearly,
  discountMonthly,
  discountTermly,
  discountYearly,
  courseStartDate,
  bookingContactUrl,
  accentColor,
  teacherName,
}: BookingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentGrade, setStudentGrade] = useState("sec_1");
  const [languageTrack, setLanguageTrack] = useState<"arabic" | "languages">("arabic");
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState<"monthly" | "termly" | "yearly" | null>(null);

  // Booking & Payment Mode State
  const [payMode, setPayMode] = useState<"wallet" | "fawry" | "balance" | "whatsapp" | "code">("wallet");
  
  // Wallet state
  const [walletPhone, setWalletPhone] = useState("");
  const [selectedWalletMethod, setSelectedWalletMethod] = useState<"vf_cash" | "et_cash" | "fawry">("vf_cash");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMsg, setWalletMsg] = useState("");
  const [walletModal, setWalletModal] = useState<{ reference: string; instructions: string; methodLabel: string; amount: number } | null>(null);

  // Balance state
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceMsg, setBalanceMsg] = useState("");

  // Code state
  const [code, setCode] = useState("");
  const [codeApplying, setCodeApplying] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) {
          setIsLoggedIn(true);
          if (d.user.name) setStudentName(d.user.name);
          if (d.user.educationalStage) setStudentGrade(d.user.educationalStage);
          if (typeof d.user.balance === "number") setUserBalance(d.user.balance);
        }
      })
      .catch(() => {});
  }, []);

  const refreshBalance = () => {
    fetch("/api/student/balance", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.balance === "number") setUserBalance(d.balance);
      })
      .catch(() => {});
  };

  const createPlan = (
    type: "monthly" | "termly" | "yearly",
    label: string,
    sublabel: string,
    rawPrice: number,
    discountPct: number | null | undefined,
    icon: string,
    accent: string,
    accentBg: string
  ): BookingPlan => {
    const hasDisc = discountPct != null && discountPct > 0 && discountPct <= 100;
    if (hasDisc) {
      const discountedPrice = Math.round(rawPrice * (1 - discountPct! / 100));
      return {
        type,
        label,
        sublabel,
        price: discountedPrice,
        originalPrice: rawPrice,
        discountPercent: discountPct!,
        icon,
        accent,
        accentBg,
      };
    }
    return {
      type,
      label,
      sublabel,
      price: rawPrice,
      icon,
      accent,
      accentBg,
    };
  };

  const baseMonthly = priceMonthly && priceMonthly > 0 ? priceMonthly : 200;
  const baseTermly = priceTermly && priceTermly > 0 ? priceTermly : 600;
  const baseYearly = priceYearly && priceYearly > 0 ? priceYearly : 1200;

  const langSurchargePerMonth = languageTrack === "languages" ? 50 : 0;

  const plans: BookingPlan[] = [
    createPlan("monthly", "اشتراك شهر واحد", "شهر واحد (1 Month)", baseMonthly + langSurchargePerMonth, discountMonthly, "📅", "#3B82F6", "rgba(59,130,246,0.1)"),
    createPlan("termly", "اشتراك 3 شهور", "3 شهور (3 Months)", baseTermly + (langSurchargePerMonth * 3), discountTermly, "📚", "#F59E0B", "rgba(245,158,11,0.1)"),
    createPlan("yearly", "اشتراك 6 شهور", "6 شهور (6 Months)", baseYearly + (langSurchargePerMonth * 6), discountYearly, "🎓", "#10B981", "rgba(16,185,129,0.1)"),
  ];

  const maxDiscount = plans.reduce((max, p) => (p.discountPercent && p.discountPercent > max ? p.discountPercent : max), 0);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanType) {
      setSelectedPlanType(plans[0].type);
    }
  }, [plans, selectedPlanType]);

  const activePlan = plans.find((p) => p.type === selectedPlanType) || plans[0];
  const gradeObj = STAGE_OPTIONS.find((s) => s.value === studentGrade);
  const gradeLabel = gradeObj ? gradeObj.label : studentGrade;

  const handleBookViaWhatsApp = (plan: BookingPlan) => {
    const waUrl = buildWhatsAppUrl(
      bookingContactUrl,
      studentName,
      gradeLabel,
      plan,
      teacherName,
      courseStartDate
    );
    window.open(waUrl, "_blank");
  };

  const handlePayViaWallet = async (plan: BookingPlan) => {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect_url=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const isWallet = selectedWalletMethod === "vf_cash" || selectedWalletMethod === "et_cash";
    if (isWallet && !walletPhone.trim()) {
      setWalletMsg("❌ رقم المحفظة مطلوب");
      return;
    }
    setWalletLoading(true);
    setWalletMsg("");
    try {
      const res = await fetch("/api/payments/sha7nawy/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: isWallet ? walletPhone.trim() : "",
          amount: plan.price,
          method: selectedWalletMethod,
          client: studentName || "Student",
          details: `حجز اشتراك (${plan.label} - ${languageTrack === "languages" ? "لغات" : "عربي"}) - أستاذ ${teacherName}`,
        }),
      });
      const d = await res.json().catch(() => ({}));
      setWalletLoading(false);
      if (res.ok && d.success) {
        const targetUrl = d.checkoutUrl || d.data?.payment_page_url || d.data?.url || (d.provider === "shakeout" && d.reference ? `https://dash.shake-out.com/invoice/${d.reference}` : null);
        if (targetUrl) {
          window.location.href = targetUrl;
          return;
        }
        setWalletModal({
          reference: d.reference || "SH-PENDING",
          instructions: d.instructions || "اطلب *9*1# لخصم من فودافون كاش أو وافق على طلب الدفع من تطبيق e& Money",
          methodLabel: d.methodLabel || "المحفظة الإلكترونية",
          amount: plan.price,
        });
      } else {
        setWalletMsg(`❌ ${d.error || "تعذر بدء عملية الدفع"}`);
      }
    } catch {
      setWalletLoading(false);
      setWalletMsg("❌ حدث خطأ أثناء الاتصال ببوابة الدفع");
    }
  };

  const handlePayViaBalance = async (plan: BookingPlan) => {
    if (!isLoggedIn) {
      setBalanceMsg("❌ يجب تسجيل الدخول للشراء بالرصيد");
      return;
    }
    setBalanceLoading(true);
    setBalanceMsg("");
    try {
      const res = await fetch("/api/teacher/subscribe-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacherId || "",
          planType: plan.type,
          languageTrack,
          amount: plan.price,
          planLabel: plan.label,
          teacherName,
        }),
      });
      const d = await res.json().catch(() => ({}));
      setBalanceLoading(false);
      if (res.ok && d.success) {
        setBalanceMsg(`✅ ${d.message}`);
        if (typeof d.newBalance === "number") setUserBalance(d.newBalance);
      } else {
        setBalanceMsg(`❌ ${d.error || "تعذر خصم الرصيد"}`);
      }
    } catch {
      setBalanceLoading(false);
      setBalanceMsg("❌ حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleApplyCode = async () => {
    if (!code.trim()) return;
    setCodeApplying(true);
    setCodeMsg("");
    try {
      const res = await fetch("/api/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      setCodeApplying(false);
      if (res.ok) {
        setCodeMsg("✅ تم تفعيل الكود بنجاح!");
        refreshBalance();
      } else {
        setCodeMsg(`❌ ${data.error || "كود غير صحيح أو مستخدم من قبل"}`);
      }
    } catch {
      setCodeApplying(false);
      setCodeMsg("❌ تعذر الاتصال بسيرفر الأكواد");
    }
  };

  return (
    <>
      {/* "ادفع الآن (عرض لفترة محدودة)" Button + Start Date */}
      <div className="flex flex-col items-center gap-2 mt-6">
        {plans.length > 0 && (
          <button
            onClick={() => { refreshBalance(); setIsOpen(true); }}
            className="relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-white text-base border-none cursor-pointer transition-all hover:brightness-110 hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 8px 32px -8px ${accentColor}80`,
            }}
          >
            <span className="absolute -top-3 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-md animate-bounce">
              عرض لفترة محدودة 🔥
            </span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            ادفع الآن (عرض لفترة محدودة)
          </button>
        )}

        {courseStartDate && (
          <p className="text-sm font-bold mt-1" style={{ color: "var(--ink-muted)" }}>
            <span style={{ color: accentColor }}>📍</span>
            {" "}بدء الكورس: {formatArabicDate(courseStartDate)}
          </p>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6 overflow-y-auto"
            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "rgba(0,0,0,0.65)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
              dir="rtl"
              style={{
                background: "var(--surface, #1a1f2e)",
                border: "1px solid var(--border, rgba(255,255,255,0.1))",
                boxShadow: "0 32px 64px -12px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center border-none cursor-pointer transition-colors"
                style={{ background: "var(--border, rgba(255,255,255,0.1))", color: "var(--ink-muted, #999)" }}
                aria-label="إغلاق"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Modal Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-3"
                  style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                  حجز الاشتراك مع {teacherName}
                </div>

                {maxDiscount > 0 && (
                  <div className="mb-2">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      🔥 عروض خاصة: خصومات تصل لـ {maxDiscount}% على خطط الاشتراك!
                    </span>
                  </div>
                )}

                <h2 className="text-xl sm:text-2xl font-black" style={{ color: "var(--ink, #fff)" }}>
                  حدد تفاصيل الحجز والدفع
                </h2>
                <p className="text-xs sm:text-sm mt-1.5" style={{ color: "var(--ink-muted, #999)" }}>
                  اختر الخطة والطريقة المناسبة لك للدفع أو إرسال الحجز
                </p>
              </div>

              {/* Student Info Inputs */}
              <div className="space-y-4 mb-6 p-4 rounded-2xl" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--ink-muted, #aaa)" }}>
                    👤 اسم الطالب
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="اكتب اسمك الثلاثي..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,rgba(255,255,255,0.1))] bg-[var(--surface,#1a1f2e)] text-[var(--ink,#fff)] text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--ink-muted, #aaa)" }}>
                    📚 الصف الدراسي / المرحلة
                  </label>
                  <select
                    value={studentGrade}
                    onChange={(e) => setStudentGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border,rgba(255,255,255,0.1))] bg-[var(--surface,#1a1f2e)] text-[var(--ink,#fff)] text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {STAGE_OPTIONS.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Language Track Selection */}
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--ink-muted, #aaa)" }}>
                    🌐 المسار التعليمي / اللغة
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLanguageTrack("arabic")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        languageTrack === "arabic"
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      <span>🇪🇬</span> عربي (الأساسي)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguageTrack("languages")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        languageTrack === "languages"
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      <span>🇬🇧</span> لغات / إنجليزي (+50ج/شهر)
                    </button>
                  </div>
                </div>
              </div>

              {/* Plans Selection */}
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold mb-1" style={{ color: "var(--ink-muted, #aaa)" }}>
                  💳 اختر خطة الاشتراك:
                </label>

                {plans.map((plan, i) => {
                  const isSelected = selectedPlanType === plan.type;
                  return (
                    <motion.div
                      key={plan.type}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.08, ease: EASE }}
                    >
                      <div
                        className="relative flex items-center justify-between gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer"
                        style={{
                          background: isSelected ? `${plan.accent}15` : "var(--bg, #0f1420)",
                          border: isSelected ? `2px solid ${plan.accent}` : "1px solid var(--border, rgba(255,255,255,0.08))",
                          boxShadow: isSelected ? `0 0 20px -4px ${plan.accent}35` : "none",
                        }}
                        onClick={() => setSelectedPlanType(plan.type)}
                      >
                        {/* Selected Radio Indicator */}
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-emerald-500" : "border-slate-500"}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>

                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ background: plan.accentBg }}>
                            {plan.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--ink, #fff)" }}>
                                {plan.label}
                              </h3>
                              {plan.discountPercent && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  -{plan.discountPercent}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "var(--ink-muted, #888)" }}>
                              {plan.sublabel}
                            </p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-left shrink-0">
                          {plan.originalPrice && (
                            <span className="text-xs line-through text-slate-400 font-bold block">
                              {plan.originalPrice} جنيه
                            </span>
                          )}
                          <span className="text-xl font-black" style={{ color: plan.accent }}>
                            {plan.price}
                          </span>
                          <span className="text-xs font-bold mr-1" style={{ color: "var(--ink-muted, #888)" }}>
                            جنيه
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Start Date Footer */}
              {courseStartDate && (
                <p className="text-center text-xs font-bold mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "var(--ink-muted, #888)" }}>
                  📍 موعد بدء الكورس: <span style={{ color: accentColor }}>{formatArabicDate(courseStartDate)}</span>
                </p>
              )}

              {/* Payment Method Tabs (Wallet / Balance / WhatsApp / Code) */}
              <div className="space-y-3 pt-2 border-t border-[var(--border,rgba(255,255,255,0.1))]">
                <label className="block text-xs font-bold text-center" style={{ color: "var(--ink-muted, #aaa)" }}>
                  اختر طريقة الحجز والدفع:
                </label>

                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.1))" }}>
                  <button
                    onClick={() => { setPayMode("wallet"); setSelectedWalletMethod("vf_cash"); }}
                    className="py-2 px-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all text-center"
                    style={{
                      background: payMode === "wallet" ? "var(--brand, #6366f1)" : "transparent",
                      color: payMode === "wallet" ? "#fff" : "var(--ink-muted, #aaa)",
                    }}
                  >
                    📱 محفظة
                  </button>

                  <button
                    onClick={() => { setPayMode("fawry"); setSelectedWalletMethod("fawry"); }}
                    className="py-2 px-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all text-center"
                    style={{
                      background: payMode === "fawry" ? "#FFCC00" : "transparent",
                      color: payMode === "fawry" ? "#000" : "var(--ink-muted, #aaa)",
                    }}
                  >
                    🏪 فوري
                  </button>

                  <button
                    onClick={() => setPayMode("balance")}
                    className="py-2 px-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all text-center"
                    style={{
                      background: payMode === "balance" ? "#D97706" : "transparent",
                      color: payMode === "balance" ? "#fff" : "var(--ink-muted, #aaa)",
                    }}
                  >
                    💰 بالرصيد
                  </button>

                  <button
                    onClick={() => setPayMode("whatsapp")}
                    className="py-2 px-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all text-center"
                    style={{
                      background: payMode === "whatsapp" ? "#25D366" : "transparent",
                      color: payMode === "whatsapp" ? "#fff" : "var(--ink-muted, #aaa)",
                    }}
                  >
                    💬 واتساب
                  </button>

                  <button
                    onClick={() => setPayMode("code")}
                    className="py-2 px-1 rounded-lg text-xs font-bold border-none cursor-pointer transition-all text-center"
                    style={{
                      background: payMode === "code" ? "#10B981" : "transparent",
                      color: payMode === "code" ? "#fff" : "var(--ink-muted, #aaa)",
                    }}
                  >
                    🔑 كود
                  </button>
                </div>

                {/* Option 1: Mobile Wallet / Fawry / Card Payment */}
                {(payMode === "wallet" || payMode === "fawry") && activePlan && (
                  <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                    {payMode === "wallet" && (
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--ink-muted, #aaa)" }}>اختر طريقة الدفع المباشر:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {[
                            { id: "vf_cash", label: "فودافون كاش", color: "#E60000" },
                            { id: "et_cash", label: "اتصالات كاش (e&)", color: "#76B900" },
                          ].map(m => (
                            <button key={m.id} type="button" onClick={() => setSelectedWalletMethod(m.id as any)}
                              className="py-2 px-1 rounded-lg text-xs font-bold border cursor-pointer transition-all text-center flex items-center justify-center gap-1"
                              style={{
                                borderColor: selectedWalletMethod === m.id ? m.color : "var(--border, rgba(255,255,255,0.1))",
                                background: selectedWalletMethod === m.id ? `${m.color}20` : "var(--surface, #1a1f2e)",
                                color: selectedWalletMethod === m.id ? m.color : "var(--ink-muted, #aaa)",
                              }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2% Tax / Fee Breakdown */}
                    <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: "var(--surface, #1a1f2e)", border: "1px solid var(--border, rgba(255,255,255,0.06))" }}>
                      <div className="flex justify-between" style={{ color: "var(--ink-muted, #aaa)" }}>
                        <span>المبلغ الأصلي:</span>
                        <span className="font-bold">{activePlan.price} جنيه</span>
                      </div>
                      <div className="flex justify-between" style={{ color: "var(--ink-muted, #aaa)" }}>
                        <span>رسوم المعاملة والخدمة (2%):</span>
                        <span className="font-bold">{Math.round(activePlan.price * 0.02 * 100) / 100} جنيه</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[var(--border,rgba(255,255,255,0.1))]" style={{ color: "var(--brand, #6366f1)" }}>
                        <span className="font-black">الإجمالي المطلوب خصمه:</span>
                        <span className="font-black text-sm">{Math.round((activePlan.price * 1.02) * 100) / 100} جنيه</span>
                      </div>
                    </div>

                    {(() => {
                      const isWallet = selectedWalletMethod === "vf_cash" || selectedWalletMethod === "et_cash";
                      const isFawry = selectedWalletMethod === "fawry";
                      const totalAmount = Math.round((activePlan.price * (isFawry ? 1.025 : 1.02)) * 100) / 100;

                      return (
                        <>
                          {isWallet && (
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: "var(--ink-muted, #aaa)" }}>
                                رقم المحفظة (11 رقماً):
                              </label>
                              <input type="tel" value={walletPhone} onChange={e => setWalletPhone(e.target.value)}
                                placeholder="01xxxxxxxxx" dir="ltr"
                                className="w-full p-2.5 rounded-xl text-center font-mono text-sm border focus:outline-none"
                                style={{ border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "var(--surface, #1a1f2e)", color: "var(--ink, #fff)" }} />
                            </div>
                          )}

                          {isFawry && (
                            <div className="p-3 rounded-xl text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 text-center leading-relaxed font-bold">
                              🏪 خيار فوري كشك: سيتم إصدار كود مرجعي (Fawry Code). يمكنك الدفع كاش بهذا الكود في أي منفذ فوري أو سوبرماركت دون الحاجة لرقم محفظة.
                            </div>
                          )}

                          <button
                            onClick={() => handlePayViaWallet(activePlan)}
                            disabled={walletLoading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all hover:opacity-90 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg, var(--brand, #6366f1), #4f46e5)" }}
                          >
                            {walletLoading
                              ? "جارٍ المعالجة..."
                              : isWallet
                              ? `خصم ${totalAmount} جنيه من المحفظة 📱`
                              : isFawry
                              ? `إصدار كود الدفع كاش بقيمة ${totalAmount} جنيه 🏪`
                              : `الانتقال للبوابة البنكية للدفع (${totalAmount} جنيه) 💳`}
                          </button>
                        </>
                      );
                    })()}
                    {walletMsg && <p className="text-xs font-semibold text-center" style={{ color: walletMsg.startsWith("❌") ? "#ef4444" : "#10b981" }}>{walletMsg}</p>}
                  </div>
                )}

                {/* Option 2: Account Balance Payment */}
                {payMode === "balance" && activePlan && (
                  <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                    <div className="flex items-center justify-between text-xs p-3 rounded-xl" style={{ background: "var(--surface, #1a1f2e)", border: "1px solid var(--border, rgba(255,255,255,0.1))" }}>
                      <span style={{ color: "var(--ink-muted, #aaa)" }}>رصيدك الحالي في المنصة:</span>
                      <span className="font-black text-amber-400 text-sm">{userBalance !== null ? `${userBalance} جنيه` : "غير معروف"}</span>
                    </div>

                    <button
                      onClick={() => handlePayViaBalance(activePlan)}
                      disabled={balanceLoading || (userBalance !== null && userBalance < activePlan.price)}
                      className="w-full py-3.5 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all disabled:opacity-50 hover:opacity-90 shadow-md flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}
                    >
                      {balanceLoading ? "جارٍ خصم الرصيد وتأكيد الحجز..." : `شراء بـ ${activePlan.price} جنيه من رصيدك 💰`}
                    </button>
                    
                    {userBalance !== null && userBalance < activePlan.price && (
                      <p className="text-xs text-center text-amber-400 font-semibold">
                        ⚠️ رصيدك لا يكفي. يمكنك التبديل إلى تبويب المحفظة 📱 أو الكود 🔑 للشحن.
                      </p>
                    )}
                    {balanceMsg && <p className="text-xs font-semibold text-center" style={{ color: balanceMsg.startsWith("❌") ? "#ef4444" : "#10b981" }}>{balanceMsg}</p>}
                  </div>
                )}

                {/* Option 3: WhatsApp Booking */}
                {payMode === "whatsapp" && activePlan && (
                  <button
                    onClick={() => handleBookViaWhatsApp(activePlan)}
                    className="w-full py-4 rounded-2xl text-base font-black text-white text-center flex items-center justify-center gap-2.5 border-none cursor-pointer transition-all hover:brightness-110 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #25D366, #128C7E)",
                      boxShadow: "0 8px 24px -4px rgba(37,211,102,0.4)",
                    }}
                  >
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.399.636-1.157 4.227 4.321-1.133.58.337z"/>
                    </svg>
                    إرسال طلب الحجز عبر الواتساب ➔
                  </button>
                )}

                {/* Option 4: Access Code */}
                {payMode === "code" && (
                  <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                    <p className="text-xs font-medium text-center" style={{ color: "var(--ink-muted, #aaa)" }}>أدخل كود تفعيل الاشتراك:</p>
                    <div className="flex gap-2">
                      <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleApplyCode()} placeholder="كود الاشتراك" maxLength={16} dir="ltr"
                        className="flex-1 rounded-xl px-3 py-2.5 text-center font-mono text-sm tracking-widest focus:outline-none border"
                        style={{ border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "var(--surface, #1a1f2e)", color: "var(--ink, #fff)" }} />
                      <button onClick={handleApplyCode} disabled={codeApplying || !code.trim()}
                        className="rounded-xl px-4 py-2.5 text-white font-bold text-sm transition-colors disabled:opacity-50"
                        style={{ background: "#10B981" }}>
                        {codeApplying ? "..." : "تفعيل"}
                      </button>
                    </div>
                    {codeMsg && <p className="text-xs font-semibold text-center" style={{ color: codeMsg.startsWith("❌") ? "#ef4444" : "#10b981" }}>{codeMsg}</p>}
                  </div>
                )}
              </div>

              {/* Sha7nawy Instruction Modal */}
              {walletModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.7)" }} onClick={() => setWalletModal(null)}>
                  <div className="w-full max-w-md rounded-2xl p-6 text-center space-y-4 shadow-2xl" style={{ background: "var(--surface, #1a1f2e)", border: "1px solid var(--border, rgba(255,255,255,0.1))" }} onClick={e => e.stopPropagation()}>
                    <div className="text-4xl">📲</div>
                    <h3 className="text-lg font-bold" style={{ color: "var(--ink, #fff)" }}>تم إرسال طلب الخصم بنجاح!</h3>
                    <p className="text-xs text-gray-400 font-mono">رقم المرجع: {walletModal.reference}</p>
                    
                    <div className="p-4 rounded-xl space-y-2 text-right text-sm" style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                      <p className="font-bold text-center" style={{ color: "var(--brand, #6366f1)" }}>تعليمات إتمام العملية:</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--ink-muted, #aaa)" }}>{walletModal.instructions}</p>
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
                            setWalletMsg("✅ تم تأكيد السحب وشحن حسابك بنجاح!");
                            refreshBalance();
                          } else {
                            setWalletMsg(`⚠️ ${d.error || "العملية معلقة بانتظار موافقة العميل من المحفظة"}`);
                          }
                        } catch {
                          setWalletLoading(false);
                          setWalletMsg("❌ تعذر الاتصال بسيرفر التأكيد");
                        }
                      }} disabled={walletLoading}
                        className="w-full py-3 rounded-xl text-white font-bold text-sm cursor-pointer border-none transition-all hover:opacity-90 shadow-md"
                        style={{ background: "linear-gradient(135deg, var(--brand, #6366f1), #4f46e5)" }}>
                        {walletLoading ? "جارٍ التحقق والتأكيد..." : "تأكيد واستعلام حالة الدفع 🔄"}
                      </button>

                      <button onClick={() => setWalletModal(null)}
                        className="w-full py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors"
                        style={{ background: "var(--bg, #0f1420)", border: "1px solid var(--border, rgba(255,255,255,0.1))", color: "var(--ink-muted, #aaa)" }}>
                        إغلاق النافذة
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
