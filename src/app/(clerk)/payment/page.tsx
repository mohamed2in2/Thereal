"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { useToast } from "@/components/ui/Toast";
import {
  listPaymentMethods,
  getPaymentMethod,
} from "@/lib/payment-methods";
import { validateVodafoneCashPhone, normalizeEgyptianPhone, calculateAmountWithTax } from "@/lib/sha7nawy";
import { PaymentMethodGrid } from "@/components/payment/PaymentMethodGrid";
import { LoadingState } from "@/components/payment/LoadingState";
import { ErrorState } from "@/components/payment/ErrorState";

type Step = "checkout" | "instructions" | "success" | "error";

interface PaymentIntent {
  reference: string;
  method: string;
  totalAmount: number;
  instructions: string;
  transactionId?: string | number;
  paymentPageUrl?: string;
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success: toastSuccess, error: toastError } = useToast();

  const amountParam = searchParams.get("amount");
  const methodParam = searchParams.get("method");
  const returnHref = searchParams.get("return");
  const teacherIdParam = searchParams.get("teacherId");
  const teacherNameParam = searchParams.get("teacherName");
  const planTypeParam = searchParams.get("planType");
  const planLabelParam = searchParams.get("planLabel");
  const gradeParam = searchParams.get("grade");
  const courseIdParam = searchParams.get("courseId");
  const folderIdParam = searchParams.get("folderId");
  const planIdParam = searchParams.get("planId");
  const contextParam = searchParams.get("context");

  const [step, setStep] = useState<Step>("checkout");
  const [baseAmount, setBaseAmount] = useState<string>("100");
  const [isPriceLocked, setIsPriceLocked] = useState(false);
  const [verifiedItemName, setVerifiedItemName] = useState<string>("");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("vf_cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // 15-Minute Countdown Timer for Payment Instructions
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(15 * 60);

  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const allMethods = listPaymentMethods();
  const availableMethods = allMethods.filter((m) => m.available);
  const selectedMethod = getPaymentMethod(selectedMethodId) || availableMethods[0];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setUser({ id: d.user.id, name: d.user.name, role: d.user.role });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  // ── Authoritative Server-Side Price Lookup on Load ──
  useEffect(() => {
    const fetchAuthoritativePrice = async () => {
      const hasSpecificItem = teacherIdParam || courseIdParam || folderIdParam || planIdParam;
      if (hasSpecificItem) {
        setIsPriceLocked(true);
        try {
          const query = new URLSearchParams();
          if (teacherIdParam) query.set("teacherId", teacherIdParam);
          if (planTypeParam) query.set("planType", planTypeParam);
          if (gradeParam) query.set("grade", gradeParam);
          if (courseIdParam) query.set("courseId", courseIdParam);
          if (folderIdParam) query.set("folderId", folderIdParam);
          if (planIdParam) query.set("planId", planIdParam);

          const res = await fetch(`/api/payments/quote?${query.toString()}`);
          if (res.ok) {
            const data = await res.json();
            if (data.expectedPrice > 0) {
              setBaseAmount(String(data.expectedPrice));
            }
            if (data.itemName) {
              setVerifiedItemName(data.itemName);
            }
          }
        } catch {
          // fallback to param if network fails
          if (amountParam && Number(amountParam) > 0) {
            setBaseAmount(amountParam);
          }
        }
      } else if (amountParam) {
        const amt = Number(amountParam);
        if (amt > 0) setBaseAmount(String(amt));
      }
    };

    fetchAuthoritativePrice();

    if (methodParam) {
      const found = getPaymentMethod(methodParam);
      if (found && found.available) {
        setSelectedMethodId(found.id);
      } else if (found && !found.available) {
        setSelectedMethodId("vf_cash");
      }
    }
  }, [amountParam, methodParam, teacherIdParam, planTypeParam, gradeParam, courseIdParam, folderIdParam, planIdParam]);

  // ── Timer Countdown ──
  useEffect(() => {
    if (step !== "instructions") return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const validatePhone = useCallback((val: string, methodId: string = selectedMethodId) => {
    if (!val.trim()) {
      setPhoneError("رقم المحفظة مطلوب لإتمام العملية");
      return false;
    }
    if (methodId === "vf_cash") {
      if (!validateVodafoneCashPhone(val)) {
        setPhoneError("رقم محفظة فودافون كاش يجب أن يبدأ بـ 010 ويتكون من 11 رقماً");
        return false;
      }
    }
    setPhoneError("");
    return true;
  }, [selectedMethodId]);

  const validateCode = useCallback((val: string) => {
    if (!val.trim()) {
      setCodeError("كود التفعيل مطلوب لإتمام العملية");
      return false;
    }
    setCodeError("");
    return true;
  }, []);

  const handleCreatePayment = async () => {
    if (!selectedMethod) return;

    if (!user) {
      toastError("يرجى تسجيل الدخول أو إنشاء حساب جديد لإتمام عملية الدفع");
      const redirectTarget = window.location.pathname + window.location.search;
      router.push(`/login?redirect_url=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    const amt = Number(baseAmount);
    if (!amt || amt < selectedMethod.minAmount) {
      toastError(`الحد الأدنى للشحن هو ${selectedMethod.minAmount} جنيه`);
      return;
    }
    if (amt > selectedMethod.maxAmount) {
      toastError(`الحد الأقصى للشحن هو ${selectedMethod.maxAmount} جنيه`);
      return;
    }

    if (selectedMethod.needsPhone && !validatePhone(phone)) {
      return;
    }

    if (selectedMethod.needsCode && !validateCode(code)) {
      return;
    }

    setIsCreating(true);
    setErrors([]);

    try {
      if (selectedMethod.id === "voucher") {
        const codeRes = await fetch("/api/codes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });
        const codeBody = await codeRes.json().catch(() => ({}));
        if (!codeRes.ok || codeBody.error) {
          setErrors([codeBody.error || "كود التفعيل غير صحيح أو منتهي الصلاحية"]);
          setStep("error");
          setIsCreating(false);
          return;
        }
        toastSuccess(codeBody.message || "تم تفعيل كود القسيمة بنجاح! 🎉");
        setStep("success");
        setIsCreating(false);
        return;
      }

      const normalizedPhone = selectedMethod.needsPhone ? normalizeEgyptianPhone(phone) : "";
      const res = await fetch("/api/payments/sha7nawy/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: selectedMethod.needsCode ? code.trim() : (normalizedPhone || "01000000000"),
          amount: effectiveBaseAmount,
          method: selectedMethod.id,
          code: selectedMethod.needsCode ? code.trim() : undefined,
          teacherId: teacherIdParam || undefined,
          planType: planTypeParam || undefined,
          grade: gradeParam || undefined,
          courseId: courseIdParam || undefined,
          folderId: folderIdParam || undefined,
          planId: planIdParam || undefined,
          courseTitle: verifiedItemName || planLabelParam || contextParam || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.success) {
        setErrors([body.error || "تعذر بدء عملية الدفع الإلكتروني حالياً"]);
        setStep("error");
        setIsCreating(false);
        return;
      }

      if (body.isPaidWithBalance) {
        toastSuccess(body.message || "تمت عملية الشراء من الرصيد بنجاح! 🎉");
        setStep("success");
        setIsCreating(false);
        return;
      }

      const redirectUrl = body.checkoutUrl || body.data?.payment_page_url || body.data?.url;
      if (redirectUrl) {
        toastSuccess("جاري تحويلك لبوابة دفع فوري (Shake-Out)... 🚀");
        window.location.href = redirectUrl;
        return;
      }

      setIntent({
        reference: body.reference || "REF-PENDING",
        method: body.method || selectedMethod.id,
        totalAmount: body.totalAmount || amt,
        instructions: body.instructions || selectedMethod.shortNote,
        transactionId: body.data?.transaction_id ?? body.data?.id,
        paymentPageUrl: body.data?.payment_page_url ?? body.data?.url ?? undefined,
      });

      setTimeLeftSeconds(15 * 60); // reset 15-minute timer
      setStep("instructions");
    } catch {
      setErrors(["حدث خطأ أثناء الاتصال ببوابة الدفع. يرجى المحاولة مرة أخرى."]);
      setStep("error");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Manual & Background Check Function ──
  const performStatusCheck = useCallback(async (isSilent = false) => {
    if (!intent) return;
    if (!isSilent) {
      setIsCheckingStatus(true);
      setCheckMessage(null);
    }

    try {
      // 1. Check status endpoint if transactionId is available
      if (intent.transactionId) {
        const res = await fetch(`/api/payments/sha7nawy/status?transactionId=${encodeURIComponent(String(intent.transactionId))}`);
        if (res.ok) {
          const data = await res.json();
          const st = String(data.status || "").toLowerCase();
          if (st === "completed" || st === "paid" || st === "success") {
            setStep("success");
            toastSuccess("تم التحقق من نجاح عملية الدفع وتفعيل الرصيد بنجاح! 🎉");
            return;
          }
        }
      }

      // 2. Also try confirmation query by ref_code
      if (intent.reference) {
        const confRes = await fetch("/api/payments/sha7nawy/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref_code: intent.reference }),
        });

        if (confRes.ok) {
          const confData = await confRes.json();
          if (confData.success && (confData.status === "completed" || confData.status === "paid" || confData.status === true)) {
            setStep("success");
            toastSuccess("تم التحقق وتأكيد سداد العملية بنجاح! 🎉");
            return;
          }
        }
      }

      if (!isSilent) {
        setCheckMessage("العملية ما زالت معلقة قيد موافقتك على هاتفك المحمول. يرجى إدخال الرقم السري في طلب الدفع ثم المحاولة مجدداً.");
      }
    } catch {
      if (!isSilent) {
        setCheckMessage("تعذر الاتصال بالخادم للتحقق. يرجى المحاولة بعد لحظات.");
      }
    } finally {
      if (!isSilent) {
        setIsCheckingStatus(false);
      }
    }
  }, [intent, toastSuccess]);

  // ── Non-Intrusive Background Auto-Polling (Keeps UI on Screen) ──
  useEffect(() => {
    if (step !== "instructions" || !intent) return;

    const interval = setInterval(() => {
      performStatusCheck(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [step, intent, performStatusCheck]);

  const handleRedirectAfterSuccess = useCallback(() => {
    if (returnHref) {
      router.push(returnHref);
    } else {
      router.push("/account");
    }
  }, [returnHref, router]);

  const rawAmt = Number(baseAmount) || 0;
  const isFawryMinAdjusted = selectedMethodId === "fawry" && rawAmt > 0 && rawAmt < 10;
  const effectiveBaseAmount = selectedMethodId === "fawry" ? Math.max(10, rawAmt) : rawAmt;
  const taxCalculation = calculateAmountWithTax(effectiveBaseAmount, selectedMethodId);

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0F19] text-[#101828] dark:text-[#F2F4F7] transition-colors duration-200">
      <Navbar user={user} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {step === "checkout" && (
          <div className="space-y-6">
            
            {/* Header */}
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#101828] dark:text-[#F2F4F7]">
                {verifiedItemName ? `سداد: ${verifiedItemName}` : contextParam || "شحن رصيد المحفظة والدفع"}
              </h1>
              <p className="text-[14px] text-[#667085] dark:text-[#98A2B3] mt-1.5 leading-relaxed">
                اختر طريقة الدفع المناسبة واستكمل بيانات السداد بأمان وسرعة فائقة.
              </p>
            </div>

            {/* Context Notice / Item summary */}
            {(verifiedItemName || planLabelParam || contextParam) && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-bold">
                <div className="flex items-center gap-2">
                  <span>📌</span>
                  <span>{verifiedItemName || planLabelParam || contextParam}</span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white font-mono font-black">
                  {baseAmount} جنيه
                </span>
              </div>
            )}

            {/* Amount Selection / Display */}
            <div className="rounded-2xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[15px] font-semibold text-[#101828] dark:text-[#F2F4F7]">
                  المبلغ المطلوب سداده (جنيه مصري)
                </label>
                {isPriceLocked && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    🔒 سعر معتمد محدد تلقائياً
                  </span>
                )}
              </div>

              {isFawryMinAdjusted && (
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-bold flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>تم رفع المبلغ تلقائياً ليكون 10 جنيهات (أقل قيمة تقبلها شبكة فوري Fawry Pay)</span>
                </div>
              )}

              <div className="relative">
                <input
                  type="number"
                  min={selectedMethod.minAmount}
                  max={selectedMethod.maxAmount}
                  disabled={isPriceLocked}
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  className={`w-full h-14 px-4 rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#F8F9FA] dark:bg-[#0B0F19] text-[#101828] dark:text-[#F2F4F7] text-[22px] font-bold focus:outline-none focus:border-emerald-500 ${
                    isPriceLocked ? "cursor-not-allowed opacity-90" : ""
                  }`}
                  placeholder="100"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#667085] dark:text-[#98A2B3]">
                  EGP
                </span>
              </div>

              {/* Tax & Total Summary */}
              <div className="pt-3 border-t border-[#E4E7EC] dark:border-[#232C36] flex items-center justify-between text-xs sm:text-sm">
                <span className="text-[#667085] dark:text-[#98A2B3]">
                  رسوم الخدمة والضرائب ({selectedMethod.feePercentage}%):
                </span>
                <span className="font-bold">
                  {taxCalculation.taxAmount > 0 ? `+${taxCalculation.taxAmount} جنيه` : "بدون رسوم إضافية"}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 pt-1">
                <span>إجمالي المبلغ المطلوب للدفع:</span>
                <span className="font-mono text-lg sm:text-xl">{taxCalculation.totalAmount} جنيه</span>
              </div>
            </div>

            {/* Payment Methods Grid */}
            <div className="space-y-3">
              <label className="text-[15px] font-semibold text-[#101828] dark:text-[#F2F4F7]">
                اختر وسيلة الدفع:
              </label>
              <PaymentMethodGrid
                methods={allMethods}
                selectedId={selectedMethodId}
                onSelect={(m) => {
                  setSelectedMethodId(m.id);
                  setPhoneError("");
                }}
              />
            </div>

            {/* Dynamic Inputs (Phone / Code) */}
            {selectedMethod.needsPhone && (
              <div className="rounded-2xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-5 shadow-sm space-y-2">
                <label className="text-[14px] font-bold text-[#101828] dark:text-[#F2F4F7]">
                  رقم محفظة فودافون كاش / الهاتف المحمول:
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) validatePhone(e.target.value);
                  }}
                  placeholder="010XXXXXXXX"
                  className="w-full h-12 px-4 rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#F8F9FA] dark:bg-[#0B0F19] text-[#101828] dark:text-[#F2F4F7] font-mono text-base focus:outline-none focus:border-emerald-500 text-right"
                />
                {phoneError && (
                  <p className="text-xs text-rose-500 font-bold mt-1">{phoneError}</p>
                )}
                <p className="text-xs text-[#667085] dark:text-[#98A2B3]">
                  سيصلك طلب تأكيد ودفع فوري على هذا الرقم المسجل به المحفظة.
                </p>
              </div>
            )}

            {selectedMethod.needsCode && (
              <div className="rounded-2xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-5 shadow-sm space-y-2">
                <label className="text-[14px] font-bold text-[#101828] dark:text-[#F2F4F7]">
                  كود السداد / كود الكارت:
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="أدخل كود الكارت أو الإيصال..."
                  className="w-full h-12 px-4 rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#F8F9FA] dark:bg-[#0B0F19] text-[#101828] dark:text-[#F2F4F7] font-mono text-base focus:outline-none focus:border-emerald-500"
                />
                {codeError && (
                  <p className="text-xs text-rose-500 font-bold mt-1">{codeError}</p>
                )}
              </div>
            )}

            {/* Action Submit Button */}
            <button
              onClick={handleCreatePayment}
              disabled={isCreating || userLoading}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-[16px] sm:text-[18px] font-black shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              {isCreating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                  </svg>
                  <span>جاري إنشاء طلب السداد وتجهيز البوابة...</span>
                </>
              ) : (
                <>
                  <span>متابعة السداد وتأكيد الطلب 💳</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/20 font-mono text-sm">
                    {taxCalculation.totalAmount} EGP
                  </span>
                </>
              )}
            </button>

          </div>
        )}

        {/* ── Instructions Step with 15-Minute Timer & Manual Check Button ── */}
        {step === "instructions" && intent && selectedMethod && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Header & Live 15-Minute Countdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7EC] dark:border-[#232C36] pb-4">
              <div>
                <h1 className="text-[20px] sm:text-[22px] font-black text-[#101828] dark:text-[#F2F4F7]">
                  تعليمات الدفع والسداد
                </h1>
                <p className="text-xs sm:text-sm text-[#667085] dark:text-[#98A2B3] mt-0.5">
                  يرجى استكمال الدفع باستخدام الرقم المرجعي أدناه.
                </p>
              </div>

              {/* 15:00 Live Expiry Countdown */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 self-start sm:self-auto">
                <span className="text-sm">⏳ مهلة الطلب:</span>
                <span className="font-mono font-black text-base">{formatTimer(timeLeftSeconds)}</span>
              </div>
            </div>

            {/* Reference Box */}
            <div className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                  الرقم المرجعي (Reference Code)
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-[#101828] dark:text-white select-all">
                  {intent.reference}
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(intent.reference);
                    setCopied(true);
                    toastSuccess("تم نسخ الرقم المرجعي للحافظة بنجاح!");
                    setTimeout(() => setCopied(false), 3000);
                  } catch {
                    /* fallback */
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    <span>نسخ الرقم</span>
                  </>
                )}
              </button>
            </div>

            {/* Numbered Steps */}
            <div className="rounded-2xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-6 shadow-sm space-y-4">
              <h2 className="text-[16px] font-bold text-[#101828] dark:text-[#F2F4F7]">
                خطوات السداد والتأكيد:
              </h2>

              <ol className="space-y-3.5 text-sm sm:text-base leading-relaxed">
                <li className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>سيصلك إشعار بطلب الدفع على رقم محفظتك خلال ثوانٍ.</span>
                </li>

                <li className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>أو اطلب <code className="px-2 py-0.5 rounded bg-[#E4E7EC] dark:bg-[#232C36] font-mono font-bold text-emerald-600 dark:text-emerald-400">#9*1*</code> من هاتفك خلال دقيقة واحدة.</span>
                </li>

                <li className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>اختر «الموافقة على طلب الدفع» وأدخل الرقم السري للمحفظة.</span>
                </li>

                <li className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>بعد إدخال الرقم السري، اضغط زر <strong>«التحقق من حالة الدفع»</strong> بالأسفل لإتمام العملية فوراً.</span>
                </li>
              </ol>

              {/* Status Message Feedback */}
              {checkMessage && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-semibold">
                  ⚠️ {checkMessage}
                </div>
              )}

              {/* Manual Check Status Action Button */}
              <div className="pt-3 border-t border-[#E4E7EC] dark:border-[#232C36] space-y-3">
                <button
                  type="button"
                  onClick={() => performStatusCheck(false)}
                  disabled={isCheckingStatus}
                  className="w-full h-13 py-3.5 rounded-xl bg-[#047857] hover:bg-[#036B4A] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white font-black text-base shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isCheckingStatus ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>جاري فحص وتأكيد العملية من مزود الخدمة...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍 التحقق من حالة الدفع وتحديث الحساب</span>
                    </>
                  )}
                </button>

                {/* Background Auto-Polling Feedback Indicator */}
                <div className="flex items-center justify-center gap-2 text-xs text-[#667085] dark:text-[#98A2B3]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>يتم الفحص التلقائي والتحديث فور سدادك من الهاتف</span>
                </div>
              </div>

            </div>

            {/* Optional external invoice redirect if provided by gateway */}
            {intent.paymentPageUrl && (
              <div className="text-center">
                <a
                  href={intent.paymentPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all"
                >
                  <span>فتح صفحة فواتير الدفع المباشرة ↗</span>
                </a>
              </div>
            )}

            {/* Back Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep("checkout")}
                className="text-xs text-[#667085] dark:text-[#98A2B3] hover:underline"
              >
                ← إلغاء والعودة لاختيار طريقة دفع أخرى
              </button>
            </div>

          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="rounded-2xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-8 shadow-md text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto text-3xl font-black">
              ✓
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#101828] dark:text-white">
                تم شحن رصيدك بنجاح! 🎉
              </h1>
              <p className="text-sm text-[#667085] dark:text-[#98A2B3] mt-2">
                تمت إضافة المبلغ وتأكيد العملية بنجاح عبر الرقم المرجعي <code className="font-mono font-bold text-emerald-500">{intent?.reference}</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRedirectAfterSuccess}
              className="h-13 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold transition-all shadow-md cursor-pointer"
            >
              {returnHref ? "العودة ومتابعة المحتوى ←" : "الذهاب إلى لوحة حسابي ←"}
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="space-y-4">
            {errors.map((msg) => (
              <ErrorState key={msg} message={msg} onRetry={() => setStep("checkout")} />
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<LoadingState label="جاري التحميل..." />}>
      <PaymentContent />
    </Suspense>
  );
}
