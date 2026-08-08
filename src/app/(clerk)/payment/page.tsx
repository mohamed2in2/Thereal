"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  listPaymentMethods,
  getPaymentMethod,
  type PaymentMethodConfig,
} from "@/lib/payment-methods";
import { validateEgyptianPhone, normalizeEgyptianPhone, calculateAmountWithTax } from "@/lib/sha7nawy";
import { PaymentMethodGrid } from "@/components/payment/PaymentMethodGrid";
import { PaymentProviderIcon } from "@/components/payment/PaymentProviderIcon";
import { LoadingState } from "@/components/payment/LoadingState";
import { ErrorState } from "@/components/payment/ErrorState";
import { PaymentStatus } from "@/components/payment/PaymentStatus";

type Step = "checkout" | "instructions" | "status" | "success" | "error";

interface PaymentIntent {
  reference: string;
  method: string;
  totalAmount: number;
  instructions: string;
  transactionId?: string | number;
  paymentPageUrl?: string;
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError, success: toastSuccess } = useToast();

  const amountParam = searchParams.get("amount");
  const methodParam = searchParams.get("method");
  const returnHref = searchParams.get("return");
  const contextLabel = searchParams.get("context") ?? "";
  const teacherIdParam = searchParams.get("teacherId");
  const teacherNameParam = searchParams.get("teacherName");
  const planTypeParam = searchParams.get("planType");
  const planLabelParam = searchParams.get("planLabel");
  const gradeParam = searchParams.get("grade");

  const [step, setStep] = useState<Step>("checkout");
  const [baseAmount, setBaseAmount] = useState<string>("100");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("vf_cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const allMethods = listPaymentMethods();
  const availableMethods = allMethods.filter((m) => m.available);
  const selectedMethod = getPaymentMethod(selectedMethodId) || availableMethods[0];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setUser(d.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    const amt = Number(amountParam);
    if (amt > 0) {
      setBaseAmount(String(amt));
    }

    if (methodParam) {
      const found = getPaymentMethod(methodParam);
      if (found && found.available) {
        setSelectedMethodId(found.id);
        setUnsupportedNotice(null);
      } else if (found && !found.available) {
        setUnsupportedNotice(
          `طريقة الدفع المحددة (${found.label}) غير متاحة حالياً عبر البوابة. تم توجيهك لاختيار إحدى الوسائل المفعلة أدناه (فوري، البطاقات، أورانج كاش، أو فودافون كاش).`
        );
        setSelectedMethodId("vf_cash");
      }
    }
  }, [amountParam, methodParam]);

  const validatePhone = useCallback((val: string) => {
    if (!val.trim()) {
      setPhoneError("رقم المحفظة مطلوب لإتمام الخصم");
      return false;
    }
    if (!validateEgyptianPhone(val)) {
      setPhoneError("رقم المحفظة غير صحيح — يجب أن يكون رقم مصري مكون من 11 رقماً يبدأ بـ 01");
      return false;
    }
    setPhoneError("");
    return true;
  }, []);

  const handleCreatePayment = async () => {
    if (!selectedMethod) return;

    if (!user) {
      toastError("يجب تسجيل الدخول أو إنشاء حساب أولاً قبل إتمام عملية الدفع");
      const redirectTarget = window.location.pathname + window.location.search;
      router.push(`/login?redirect_url=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    const amt = Number(baseAmount);
    if (!amt || amt < selectedMethod.minAmount) {
      toastError(`الحد الأدنى للشحن عبر ${selectedMethod.label} هو ${selectedMethod.minAmount} جنيه`);
      return;
    }
    if (amt > selectedMethod.maxAmount) {
      toastError(`الحد الأقصى للشحن عبر ${selectedMethod.label} هو ${selectedMethod.maxAmount.toLocaleString()} جنيه`);
      return;
    }

    if (selectedMethod.needsPhone && !validatePhone(phone)) {
      return;
    }

    setIsCreating(true);
    setErrors([]);

    try {
      const normalizedPhone = selectedMethod.needsPhone ? normalizeEgyptianPhone(phone) : "";
      const res = await fetch("/api/payments/sha7nawy/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: normalizedPhone,
          amount: amt,
          method: selectedMethod.id,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.success) {
        setErrors([body.error || "تعذر بدء عملية الدفع عبر البوابة"]);
        setStep("error");
        setIsCreating(false);
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

      setStep("instructions");
    } catch {
      setErrors(["حدث خطأ أثناء الاتصال ببوابة الدفع — يرجى المحاولة مرة أخرى"]);
      setStep("error");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (step === "instructions" && intent) {
      const t = setTimeout(() => setStep("status"), 1500);
      return () => clearTimeout(t);
    }
  }, [step, intent]);

  const handlePaymentSuccess = useCallback(() => {
    setStep("success");
  }, []);

  const handleRedirectAfterSuccess = useCallback(() => {
    if (returnHref) {
      const safe = returnHref.startsWith("/") ? returnHref : "/account";
      router.push(safe);
    } else {
      router.push("/account");
    }
  }, [returnHref, router]);

  const { baseAmount: calcBase, taxAmount: calcTax, totalAmount: calcTotal, feePercentage: calcFee } =
    calculateAmountWithTax(Number(baseAmount) || 0, selectedMethod?.id || "vf_cash");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 font-sans">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        {!userLoading && !user && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-5 text-center dir-rtl">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="text-base font-extrabold text-amber-700 dark:text-amber-300 mb-1">
              يلزم تسجيل الدخول أو إنشاء حساب لإتمام عملية الدفع
            </h3>
            <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 mb-4 max-w-md mx-auto">
              عفواً، يجب أن تملك حساباً مفصلاً على المنصة حتى يتم ربط رصيدك واشتراكاتك بحسابك الشخصي بصفة دائمة.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => {
                  const target = window.location.pathname + window.location.search;
                  router.push(`/login?redirect_url=${encodeURIComponent(target)}`);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 text-xs sm:text-sm rounded-xl"
              >
                تسجيل الدخول 🔑
              </Button>
              <Button
                onClick={() => {
                  const target = window.location.pathname + window.location.search;
                  router.push(`/signup?redirect_url=${encodeURIComponent(target)}`);
                }}
                variant="outline"
                className="font-bold px-5 py-2 text-xs sm:text-sm rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                إنشاء حساب جديد ✨
              </Button>
            </div>
          </div>
        )}

        {teacherIdParam && (
          <div className="mb-6 rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-6 shadow-xl space-y-4 text-right dir-rtl">
            <div className="flex items-center justify-between">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black">
                🎓 تفاصيل طلب الاشتراك في المنصة
              </span>
              <span className="text-xs text-gray-400 font-mono">كود المعلم: #{teacherIdParam.slice(0, 8)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 font-semibold block mb-1">المعلم المعني</span>
                <p className="text-base font-black text-white">أستاذ {teacherNameParam || "المعلم"}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 font-semibold block mb-1">الصف الدراسي</span>
                <p className="text-base font-black text-sky-400">
                  {gradeParam === "sec_2" ? "ثانية بكالوريا" : "أولى بكالوريا"}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 font-semibold block mb-1">نوع الاشتراك</span>
                <p className="text-base font-black text-amber-400">{planLabelParam || "اشتراك"}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-300">إجمالي المبلغ المطلوب للدفع:</span>
              <span className="text-2xl font-black text-emerald-400">{baseAmount} جنيه</span>
            </div>
          </div>
        )}

        {contextLabel && !teacherIdParam && (
          <div className="mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              📌 {contextLabel}
            </p>
          </div>
        )}

        {unsupportedNotice && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 dir-rtl text-right">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 leading-relaxed">
                {unsupportedNotice}
              </p>
            </div>
          </div>
        )}

        {step === "checkout" && (
          <div dir="rtl" className="space-y-8">
            {/* Header Title */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                إتمام عملية الدفع وشحن الرصيد
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                اختر طريقة الدفع المناسبة وأدخل بيانات الشحن بأمان تام عبر بوابات الدفع الرسمية.
              </p>
            </div>

            {/* Step 1: Amount Selection & Calculator */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  1
                </span>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  المبلغ والرسوم الشفافة
                </h2>
              </div>

              {/* Amount Presets */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">
                  اختر مبلغ الشحن الأساسي (ج.م):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_AMOUNTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBaseAmount(String(p))}
                      className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                        baseAmount === String(p)
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {p} <span className="text-xs opacity-60">جنيه</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 max-w-xs">
                  <input
                    type="number"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="100"
                    min={5}
                    max={50000}
                    dir="ltr"
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-center text-lg font-bold text-gray-900 outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Realtime Fee Breakdown */}
              {selectedMethod && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-emerald-50/60 p-4 text-center dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">المبلغ المطلوب</span>
                    <p className="text-base font-black text-gray-900 dark:text-white">{calcBase.toFixed(2)} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                      رسوم الخدمة ({calcFee}%)
                    </span>
                    <p className="text-base font-black text-amber-600 dark:text-amber-400">+{calcTax.toFixed(2)} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">إجمالي الخصم</span>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{calcTotal.toFixed(2)} ج.م</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Verified Gateways & Payment Method Selection */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    2
                  </span>
                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                    وسائل الدفع المتاحة والموثقة
                  </h2>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  معتمدة ومأمنة 100%
                </span>
              </div>

              {/* Provider Information Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    ⚡ بوابة Shake-Out (dash.shake-out.com)
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                    تخدم: فوري باي كشك، الفيزا وماستركارد، ميزة الوطنية، وأورانج كاش.
                  </p>
                </div>
                <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-3.5 dark:border-teal-900/50 dark:bg-teal-950/20">
                  <p className="text-xs font-black text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                    📱 بوابة Sha7nawy (gate.sha7nawy.com)
                  </p>
                  <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 font-medium">
                    تخدم: فودافون كاش (*9*1#).
                  </p>
                </div>
              </div>

              {/* Methods Grid */}
              <PaymentMethodGrid
                methods={allMethods}
                selectedId={selectedMethodId}
                onSelect={(m) => {
                  if (m.available) {
                    setSelectedMethodId(m.id);
                  } else {
                    toastError(m.unavailableNote || "طريقة الدفع غير متاحة حالياً");
                  }
                }}
                showFilters={false}
              />
            </div>

            {/* Step 3: Phone Entry & Action */}
            {selectedMethod && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    3
                  </span>
                  <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                    تأكيد وإرسال طلب الدفع
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <PaymentProviderIcon method={selectedMethod} size={40} />
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                      {selectedMethod.label}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedMethod.labelEn} • {selectedMethod.processingSpeed}
                    </p>
                  </div>
                </div>

                {/* Phone Input if required */}
                {selectedMethod.needsPhone && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      أدخل رقم المحفظة الإلكترونية (11 رقماً):
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      onBlur={() => validatePhone(phone)}
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      className={`w-full rounded-xl border-2 px-4 py-3 text-center text-lg font-mono outline-none transition-colors ${
                        phoneError
                          ? "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/20"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                      } dark:text-white`}
                    />
                    {phoneError && (
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
                        {phoneError}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex justify-center">
                  <Button
                    onClick={handleCreatePayment}
                    isLoading={isCreating}
                    size="lg"
                    className="w-full sm:w-auto min-w-[260px] rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg text-sm font-extrabold py-3.5"
                  >
                    تأكيد ودفع {calcTotal.toFixed(2)} ج.م بواسطة {selectedMethod.label} ←
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP: INSTRUCTIONS ════ */}
        {step === "instructions" && intent && selectedMethod && (
          <div dir="rtl" className="space-y-6 max-w-xl mx-auto">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 space-y-5">
              <div className="flex items-center gap-3">
                <PaymentProviderIcon method={selectedMethod} size={44} />
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    {selectedMethod.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedMethod.labelEn}
                  </p>
                </div>
              </div>

              {/* Reference box */}
              <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  رقم المرجع (Reference Code):
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded-xl bg-white px-3.5 py-2.5 text-center text-xl font-mono font-black tracking-wider text-emerald-900 shadow-inner dark:bg-gray-950 dark:text-emerald-100">
                    {intent.reference}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(intent.reference);
                        toastSuccess("تم نسخ رقم المرجع");
                      } catch {
                        /* noop */
                      }
                    }}
                    className="shrink-0 rounded-xl border-2 border-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                  >
                    نسخ
                  </button>
                </div>
              </div>

              {/* Instructions steps */}
              {selectedMethod.instructions.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">
                    خطوات إتمام الدفع:
                  </h4>
                  <ol className="space-y-2">
                    {selectedMethod.instructions.map((s, i) => (
                      <li key={i} className="flex gap-3 text-xs text-gray-700 dark:text-gray-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {intent.paymentPageUrl && (
                <a
                  href={intent.paymentPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                >
                  فتح صفحة السداد الرسمية ←
                </a>
              )}
            </div>

            <p className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500">
              جاري التحقق التلقائي من التأكيد والاستعلام …
            </p>
          </div>
        )}

        {/* ════ STEP: STATUS ════ */}
        {step === "status" && intent?.transactionId && (
          <div className="max-w-md mx-auto">
            <PaymentStatus
              transactionId={String(intent.transactionId)}
              onSuccess={handlePaymentSuccess}
            />
            <div className="mt-4 flex justify-center" dir="rtl">
              <Button variant="secondary" size="sm" onClick={() => setStep("instructions")}>
                ← عرض التعليمات والرقم المرجعي
              </Button>
            </div>
          </div>
        )}

        {/* ════ STEP: SUCCESS ════ */}
        {step === "success" && (
          <div
            dir="rtl"
            className="flex flex-col items-center gap-5 max-w-md mx-auto rounded-3xl border border-emerald-200 bg-emerald-50/80 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40 shadow-xl"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div>
              <h3 className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                تمت عملية الشحن والسداد بنجاح!
              </h3>
              <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                تمت إضافة {intent?.totalAmount?.toFixed(2) ?? Number(baseAmount).toFixed(2)} جنيه إلى محفظتك بالمنصة.
              </p>
            </div>
            <Button onClick={handleRedirectAfterSuccess} size="lg" className="w-full rounded-xl bg-emerald-600 text-white font-extrabold">
              العودة واستكمال التصفح ←
            </Button>
          </div>
        )}

        {/* ════ STEP: ERROR ════ */}
        {step === "error" && (
          <div dir="rtl" className="max-w-md mx-auto space-y-4">
            {errors.map((msg) => (
              <ErrorState key={msg} message={msg} onRetry={() => setStep("checkout")} />
            ))}
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setStep("checkout")}>
                اختيار وسيلة دفع أخرى
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<LoadingState label="جاري تحميل صفحة الدفع والوسائل المتاحة …" />}>
      <PaymentContent />
    </Suspense>
  );
}
