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
  stagePricing?: string | null;
  priceLanguagesMonthly?: number | null;
  priceLanguagesTermly?: number | null;
  priceLanguagesYearly?: number | null;
  enableLanguagesTrack?: boolean;
  paymentNotes?: string | null;
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
  let rawNumber = contactUrl ? contactUrl.trim() : "201118802621";
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
  stagePricing,
  priceLanguagesMonthly,
  priceLanguagesTermly,
  priceLanguagesYearly,
  enableLanguagesTrack = true,
  paymentNotes,
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

  // Extract per-grade pricing config from stagePricing JSON
  let stageConfig = {
    priceMonthly: priceMonthly ?? 180,
    priceTermly: priceTermly ?? 750,
    priceYearly: priceYearly ?? 1200,
    priceLanguagesMonthly: priceLanguagesMonthly ?? 0,
    priceLanguagesTermly: priceLanguagesTermly ?? 0,
    priceLanguagesYearly: priceLanguagesYearly ?? 0,
    discountMonthly: discountMonthly ?? null,
    discountTermly: discountTermly ?? null,
    discountYearly: discountYearly ?? null,
  };

  if (stagePricing) {
    try {
      const parsedMap = JSON.parse(stagePricing);
      if (parsedMap && parsedMap[studentGrade]) {
        const g = parsedMap[studentGrade];
        stageConfig = {
          priceMonthly: g.priceMonthly ?? priceMonthly ?? 180,
          priceTermly: g.priceTermly ?? priceTermly ?? 750,
          priceYearly: g.priceYearly ?? priceYearly ?? 1200,
          priceLanguagesMonthly: g.priceLanguagesMonthly ?? priceLanguagesMonthly ?? 0,
          priceLanguagesTermly: g.priceLanguagesTermly ?? priceLanguagesTermly ?? 0,
          priceLanguagesYearly: g.priceLanguagesYearly ?? priceLanguagesYearly ?? 0,
          discountMonthly: g.discountMonthly ?? discountMonthly ?? null,
          discountTermly: g.discountTermly ?? discountTermly ?? null,
          discountYearly: g.discountYearly ?? discountYearly ?? null,
        };
      }
    } catch {}
  }

  const baseMonthly = stageConfig.priceMonthly > 0 ? stageConfig.priceMonthly : 180;
  const baseTermly = stageConfig.priceTermly > 0 ? stageConfig.priceTermly : 750;
  const baseYearly = stageConfig.priceYearly > 0 ? stageConfig.priceYearly : 1200;

  const isLanguages = languageTrack === "languages";
  const langMonthly = stageConfig.priceLanguagesMonthly ?? 0;
  const langTermly = stageConfig.priceLanguagesTermly ?? 0;
  const langYearly = stageConfig.priceLanguagesYearly ?? 0;

  const monthlyPrice = baseMonthly + (isLanguages ? langMonthly : 0);
  const termlyPrice = baseTermly + (isLanguages ? langTermly : 0);
  const yearlyPrice = baseYearly + (isLanguages ? langYearly : 0);

  const plans: BookingPlan[] = [
    createPlan(
      "monthly",
      `اشتراك شهر واحد ${isLanguages ? "(لغات)" : "(عربي)"}`,
      "شهر واحد فقط",
      monthlyPrice,
      null,
      "📅",
      "#3B82F6",
      "rgba(59,130,246,0.1)"
    ),
    createPlan(
      "termly",
      `اشتراك الترم ${isLanguages ? "(لغات)" : "(عربي)"}`,
      "ترم دراسي كامل",
      termlyPrice,
      null,
      "📚",
      "#F59E0B",
      "rgba(245,158,11,0.1)"
    ),
    createPlan(
      "yearly",
      `اشتراك سنة كاملة ${isLanguages ? "(لغات)" : "(عربي)"}`,
      "سنة دراسية كاملة",
      yearlyPrice,
      null,
      "🎓",
      "#10B981",
      "rgba(16,185,129,0.1)"
    ),
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

  return (
    <>
      {/* "ادفع الآن (عرض لفترة محدودة)" Button + Start Date */}
      <div className="flex flex-col items-center gap-2 mt-6">
        {plans.length > 0 && (
          <button
            onClick={() => setIsOpen(true)}
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

                {enableLanguagesTrack && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--ink-muted, #aaa)" }}>
                      🌐 مسار الدراسة (عربي / لغات):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLanguageTrack("arabic")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          languageTrack === "arabic"
                            ? "bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-md"
                            : "bg-[var(--surface,#1a1f2e)] text-[var(--ink-muted,#888)] border-[var(--border,rgba(255,255,255,0.1))] hover:text-white"
                        }`}
                      >
                        <span>🇪🇬</span> المسار العربي
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguageTrack("languages")}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          languageTrack === "languages"
                            ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-md"
                            : "bg-[var(--surface,#1a1f2e)] text-[var(--ink-muted,#888)] border-[var(--border,rgba(255,255,255,0.1))] hover:text-white"
                        }`}
                      >
                        <span>🇬🇧</span> مسار اللغات / إنجليزي
                      </button>
                    </div>
                  </div>
                )}
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
                <p className="text-center text-xs font-bold mb-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "var(--ink-muted, #888)" }}>
                  📍 موعد بدء الكورس: <span style={{ color: accentColor }}>{formatArabicDate(courseStartDate)}</span>
                </p>
              )}

              {/* Teacher Custom Payment Notes */}
              {paymentNotes && (
                <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold leading-relaxed">
                  <span className="font-bold text-amber-400 block mb-0.5">📢 ملاحظات المعلم والدفع:</span>
                  {paymentNotes}
                </div>
              )}

              {/* Payment CTA Section */}
              <div className="space-y-3 pt-4 border-t border-[var(--border,rgba(255,255,255,0.1))]">
                {isLoggedIn && userBalance !== null && userBalance >= activePlan.price && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/teacher/subscribe-balance", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            teacherId,
                            planType: activePlan.type,
                            languageTrack,
                            studentGrade,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert(data.message || "تم حجز وتفعيل الاشتراك بنجاح! 🎉");
                          setIsOpen(false);
                          window.location.reload();
                        } else {
                          alert(data.error || "حدث خطأ أثناء الخصم من الرصيد");
                        }
                      } catch {
                        alert("تعذر الاتصال بالخادم لإتمام العملية");
                      }
                    }}
                    className="w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡ اشترك الآن فوراً برصيدك المتاح ({userBalance} جنيه)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams({
                      amount: String(activePlan.price),
                      teacherId: teacherId || "",
                      teacherName: teacherName || "",
                      planType: activePlan.type,
                      planLabel: activePlan.label,
                      grade: studentGrade,
                      languageTrack,
                      context: `حجز ${activePlan.label} — ${gradeLabel} مع الأستاذ ${teacherName}`,
                    });
                    window.location.href = `/payment?${params.toString()}`;
                  }}
                  className="w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-3 cursor-pointer transform active:scale-98"
                >
                  <span>ادفع وسدد الآن 💳</span>
                  <span className="bg-white/20 px-3.5 py-1 rounded-xl text-sm font-mono">{activePlan.price} جنيه</span>
                </button>

                {bookingContactUrl && (
                  <button
                    type="button"
                    onClick={() => handleBookViaWhatsApp(activePlan)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>💬 أو التواصل المباشر عبر واتساب المعلم</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
