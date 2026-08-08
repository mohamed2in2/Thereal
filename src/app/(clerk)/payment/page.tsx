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
  const { error: toastError } = useToast();

  const amountParam = searchParams.get("amount");
  const methodParam = searchParams.get("method");
  const returnHref = searchParams.get("return");
  const teacherNameParam = searchParams.get("teacherName");
  const planLabelParam = searchParams.get("planLabel");

  const [step, setStep] = useState<Step>("checkout");
  const [baseAmount, setBaseAmount] = useState<string>("100");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("vf_cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);

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
      } else if (found && !found.available) {
        setSelectedMethodId("vf_cash");
      }
    }
  }, [amountParam, methodParam]);

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
      const normalizedPhone = selectedMethod.needsPhone ? normalizeEgyptianPhone(phone) : "";
      const res = await fetch("/api/payments/sha7nawy/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: selectedMethod.needsCode ? code.trim() : (normalizedPhone || "01000000000"),
          amount: amt,
          method: selectedMethod.id,
          code: selectedMethod.needsCode ? code.trim() : undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.success) {
        setErrors([body.error || "تعذر بدء عملية الدفع الإلكتروني حالياً"]);
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
      setErrors(["حدث خطأ أثناء الاتصال ببوابة الدفع. يرجى المحاولة مرة أخرى."]);
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

  const { baseAmount: calcBase, taxAmount: calcTax, totalAmount: calcTotal } =
    calculateAmountWithTax(Number(baseAmount) || 0, selectedMethod?.id || "vf_cash");

  const orderTitle = teacherNameParam || planLabelParam
    ? `${teacherNameParam ? `أستاذ ${teacherNameParam}` : ""}${teacherNameParam && planLabelParam ? " • " : ""}${planLabelParam || ""}`
    : "شحن رصيد المحفظة";

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-[#F7F8FA] dark:bg-[#0B0F14] text-[#101828] dark:text-[#F2F4F7] font-sans">
      <Navbar />

      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8 pb-28 sm:pb-12">

        {step === "checkout" && (
          <div className="space-y-6">

            {/* Page Title */}
            <div>
              <h1 className="text-[20px] font-semibold text-[#101828] dark:text-[#F2F4F7]">
                الدفع وشحن الرصيد
              </h1>
            </div>

            {/* Section 1: Order Summary */}
            <div className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-normal text-[#101828] dark:text-[#F2F4F7] truncate">
                    {orderTitle}
                  </div>
                  <div className="text-[13px] font-medium text-[#667085] dark:text-[#98A2B3] tabular-nums mt-1">
                    {calcBase.toFixed(2)} جنيه + {calcTax.toFixed(2)} رسوم = {calcTotal.toFixed(2)} جنيه
                  </div>
                </div>

                <div className="text-[32px] font-bold text-[#047857] dark:text-[#10B981] tabular-nums shrink-0">
                  {calcTotal.toFixed(2)} <span className="text-[15px] font-normal">جنيه</span>
                </div>
              </div>
            </div>

            {/* Section 2: Amount Selector (only when no fixed amount param) */}
            {!amountParam && (
              <div>
                <h2 className="text-[17px] font-semibold text-[#101828] dark:text-[#F2F4F7] mb-4">
                  المبلغ
                </h2>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_AMOUNTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setBaseAmount(String(p))}
                        className={`h-10 rounded-lg border px-4 text-[15px] font-normal tabular-nums transition-colors ${
                          baseAmount === String(p)
                            ? "border-[#047857] dark:border-[#10B981] bg-[#047857]/5 dark:bg-[#10B981]/10 text-[#101828] dark:text-[#F2F4F7]"
                            : "border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] text-[#101828] dark:text-[#F2F4F7] hover:border-[#667085] dark:hover:border-[#98A2B3]"
                        }`}
                      >
                        {p} جنيه
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      value={baseAmount}
                      onChange={(e) => setBaseAmount(e.target.value)}
                      placeholder="100"
                      min={5}
                      max={50000}
                      dir="ltr"
                      className="w-full h-12 rounded-lg border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] pe-12 ps-4 text-right text-[15px] font-normal tabular-nums text-[#101828] dark:text-[#F2F4F7] outline-none focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981]"
                    />
                    <span aria-hidden className="absolute right-4 top-3 text-[15px] font-normal text-[#667085] dark:text-[#98A2B3] pointer-events-none">
                      جنيه
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Payment Method Selector */}
            <div>
              <h2 className="text-[17px] font-semibold text-[#101828] dark:text-[#F2F4F7] mb-4">
                طريقة الدفع
              </h2>

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

            {/* Section 4: Phone Entry & Confirm Action */}
            {selectedMethod && (
              <div className="space-y-4">
                {selectedMethod.needsPhone && (
                  <div>
                    <label htmlFor="phone-input" className="text-[15px] font-normal text-[#101828] dark:text-[#F2F4F7] mb-2 block">
                      رقم المحفظة أو الهاتف
                    </label>
                    <input
                      id="phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      onBlur={() => validatePhone(phone)}
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      aria-describedby={phoneError ? "phone-error" : undefined}
                      className={`w-full h-[52px] rounded-lg border px-4 text-left text-[17px] font-normal tabular-nums outline-none transition-colors ${
                        phoneError
                          ? "border-[#B42318] dark:border-[#F04438] bg-[#FFFFFF] dark:bg-[#141A21] text-[#101828] dark:text-[#F2F4F7]"
                          : "border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] text-[#101828] dark:text-[#F2F4F7] focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981]"
                      }`}
                    />
                    {phoneError && (
                      <p id="phone-error" role="alert" className="text-[13px] font-medium text-[#B42318] dark:text-[#F04438] mt-2 flex items-center gap-1.5">
                        <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{phoneError}</span>
                      </p>
                    )}
                  </div>
                )}

                {selectedMethod.needsCode && (
                  <div>
                    <label htmlFor="code-input" className="text-[15px] font-normal text-[#101828] dark:text-[#F2F4F7] mb-2 block">
                      كود التفعيل أو قسيمة الشحن
                    </label>
                    <input
                      id="code-input"
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (codeError) validateCode(e.target.value);
                      }}
                      onBlur={() => validateCode(code)}
                      placeholder="أدخل كود التفعيل هنا (مثال: CODE123)"
                      dir="ltr"
                      aria-describedby={codeError ? "code-error" : undefined}
                      className={`w-full h-[52px] rounded-lg border px-4 text-left text-[17px] font-normal tabular-nums outline-none transition-colors uppercase ${
                        codeError
                          ? "border-[#B42318] dark:border-[#F04438] bg-[#FFFFFF] dark:bg-[#141A21] text-[#101828] dark:text-[#F2F4F7]"
                          : "border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] text-[#101828] dark:text-[#F2F4F7] focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981]"
                      }`}
                    />
                    {codeError && (
                      <p id="code-error" role="alert" className="text-[13px] font-medium text-[#B42318] dark:text-[#F04438] mt-2 flex items-center gap-1.5">
                        <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{codeError}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Primary Action Button (Inline on Desktop, Sticky Bar on Mobile) */}
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] dark:bg-[#141A21] border-t border-[#E4E7EC] dark:border-[#232C36] p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-4 sm:static sm:z-auto sm:bg-transparent sm:border-none sm:p-0">
                  <div className="text-[20px] font-semibold text-[#047857] dark:text-[#10B981] tabular-nums sm:hidden">
                    {calcTotal.toFixed(2)} جنيه
                  </div>

                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={handleCreatePayment}
                    className="h-[52px] w-full sm:w-full rounded-xl bg-[#047857] hover:bg-[#036B4A] dark:bg-[#10B981] dark:hover:bg-[#34D399] text-white text-[17px] font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[#047857] dark:focus-visible:ring-[#10B981] focus-visible:ring-offset-2"
                  >
                    {isCreating ? (
                      <>
                        <svg aria-hidden className="w-5 h-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                        </svg>
                        <span>جاري التأكيد</span>
                      </>
                    ) : selectedMethod.needsCode ? (
                      `تفعيل كود الشحن (${calcTotal.toFixed(2)} جنيه)`
                    ) : (
                      `ادفع ${calcTotal.toFixed(2)} جنيه بـ ${selectedMethod.label}`
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Section 5: Alternative WhatsApp Footnote */}
            <div className="text-center text-[15px] font-normal text-[#667085] dark:text-[#98A2B3] mt-6">
              تحتاج إلى مساعدة في عملية السداد؟{" "}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`السلام عليكم، أود استكمال الحجز والدفع بقيمة ${baseAmount} جنيه`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#047857] dark:text-[#10B981] underline font-medium min-h-[44px] inline-flex items-center me-1"
              >
                تواصل معنا عبر الواتساب
              </a>
            </div>

          </div>
        )}

        {/* Instructions / Reference Step */}
        {step === "instructions" && intent && selectedMethod && (
          <div className="space-y-6">
            <h1 className="text-[17px] font-semibold text-[#101828] dark:text-[#F2F4F7]">
              تعليمات الدفع
            </h1>

            <div className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-4 shadow-sm space-y-4">
              <div className="border border-dashed border-[#E4E7EC] dark:border-[#232C36] rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-[#667085] dark:text-[#98A2B3]">
                    الرقم المرجعي
                  </div>
                  <div className="text-[32px] font-bold tabular-nums tracking-[0.08em] text-[#101828] dark:text-[#F2F4F7] mt-1">
                    {intent.reference}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(intent.reference);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* noop */
                    }
                  }}
                  className="h-10 px-4 rounded-lg border border-[#E4E7EC] dark:border-[#232C36] text-[15px] font-medium text-[#101828] dark:text-[#F2F4F7] hover:bg-[#E4E7EC]/30 dark:hover:bg-[#232C36]/30 transition-colors shrink-0"
                >
                  {copied ? "تم النسخ" : "نسخ"}
                </button>
              </div>

              {selectedMethod.instructions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h2 className="text-[15px] font-medium text-[#101828] dark:text-[#F2F4F7]">
                    خطوات السداد:
                  </h2>
                  <ol className="space-y-3">
                    {selectedMethod.instructions.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] text-[#101828] dark:text-[#F2F4F7] leading-[1.6]">
                        <span aria-hidden className="w-6 h-6 rounded-full bg-[#E4E7EC] dark:bg-[#232C36] text-[#667085] dark:text-[#98A2B3] text-[13px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Status Step */}
        {step === "status" && intent?.transactionId && (
          <div>
            <PaymentStatus
              transactionId={String(intent.transactionId)}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="rounded-xl border border-[#E4E7EC] dark:border-[#232C36] bg-[#FFFFFF] dark:bg-[#141A21] p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-[#047857] dark:bg-[#10B981] text-white flex items-center justify-center mx-auto">
              <svg aria-hidden className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-[20px] font-semibold text-[#101828] dark:text-[#F2F4F7] mt-4">
              تمت عملية الشحن والسداد بنجاح
            </h1>
            <p className="text-[15px] font-normal text-[#667085] dark:text-[#98A2B3] mt-2">
              تمت إضافة {intent?.totalAmount?.toFixed(2) ?? Number(baseAmount).toFixed(2)} جنيه إلى حسابك بالمنصة.
            </p>

            <button
              type="button"
              onClick={handleRedirectAfterSuccess}
              className="h-[52px] w-full rounded-xl bg-[#047857] hover:bg-[#036B4A] dark:bg-[#10B981] dark:hover:bg-[#34D399] text-white text-[17px] font-semibold mt-6 transition-colors duration-150"
            >
              العودة إلى الحساب
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

