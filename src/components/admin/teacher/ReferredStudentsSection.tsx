"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Attribution {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  purchaseType: string;
  amount: number;
  promoCodeUsed?: string;
  createdAt: string;
}

interface ReferredStudent {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}

export function ReferredStudentsSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [newCodeInput, setNewCodeInput] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalReferredCount, setTotalReferredCount] = useState(0);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [referredStudents, setReferredStudents] = useState<ReferredStudent[]>([]);

  const fetchPromoData = async () => {
    try {
      const [codeRes, refRes] = await Promise.all([
        fetch("/api/admin/teacher/promo-code", { credentials: "include" }),
        fetch("/api/admin/teacher/referred-students", { credentials: "include" }),
      ]);

      const codeData = await codeRes.json();
      const refData = await refRes.json();

      if (codeRes.ok && codeData.enabled !== false) {
        setEnabled(true);
        setPromoCode(codeData.promoCode || "");
        setNewCodeInput(codeData.promoCode || "");
        setExpiresAt(codeData.expiresAt || null);
        setIsExpired(!!codeData.isExpired);
      } else {
        setEnabled(false);
      }

      if (refRes.ok && refData.enabled !== false) {
        setTotalAmount(refData.totalAmount || 0);
        setTotalReferredCount(refData.totalReferredStudentsCount || 0);
        setAttributions(refData.attributions || []);
        setReferredStudents(refData.referredStudents || []);
      }
    } catch (err) {
      console.error("Failed to load promo referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPromoData();
  }, []);

  const handleSavePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeInput.trim()) {
      toastError("يرجى إدخال اسم كود الخصم");
      return;
    }
    setSavingCode(true);
    try {
      const res = await fetch("/api/admin/teacher/promo-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: newCodeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess(data.message || "تم حفظ كود الخصم بنجاح");
        fetchPromoData();
      } else {
        toastError(data.error || "تعذر حفظ كود الخصم");
      }
    } catch {
      toastError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setSavingCode(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className="p-8 text-center text-sm font-bold text-[var(--ink-3)] animate-pulse">
        جارٍ تحميل بيانات الطلاب المحالين...
      </div>
    );
  }

  if (!enabled) {
    return (
      <div dir="rtl" className="rounded-2xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-4xl mb-3">🏷️</div>
        <h3 className="text-lg font-black mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
          برنامج كود الخصم والإحالة
        </h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--ink-2)" }}>
          برنامج كود الخصم غير مفعّل لحسابك حالياً. يمكنك التواصل مع المشرف العام لتفعيل البرنامج لحسابك.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "var(--ink-3)" }}>إجمالي الإيرادات المُحالة</div>
          <div className="text-2xl font-black" style={{ color: "var(--brand)", fontFamily: "var(--font-head)" }}>
            {totalAmount.toLocaleString("ar-EG")} ج.م
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>إجمالي المبالغ الناتجة عن كود الإحالة</div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "var(--ink-3)" }}>عدد الطلاب المسجلين بكودك</div>
          <div className="text-2xl font-black" style={{ color: "var(--gold-2)", fontFamily: "var(--font-head)" }}>
            {totalReferredCount.toLocaleString("ar-EG")} طالب
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>طلاب قاموا بإنشاء حساب باستخدام كودك</div>
        </div>

        <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <div className="text-xs font-bold mb-1" style={{ color: "var(--ink-3)" }}>حالة كود الخصم الحالي</div>
            <div className="font-bold text-base" style={{ color: "var(--ink)" }}>
              {promoCode ? <span className="font-mono text-[var(--brand)] px-2 py-0.5 rounded-lg bg-[var(--brand-soft)]">{promoCode}</span> : "لم يُحدد كود بعد"}
            </div>
          </div>
          {expiresAt && (
            <div className={`text-[11px] mt-2 font-semibold ${isExpired ? "text-[var(--danger)]" : "text-[var(--ink-2)]"}`}>
              {isExpired ? "⚠️ منتهي الصلاحية (مر 350 يوماً)" : `صالح حتى: ${new Date(expiresAt).toLocaleDateString("ar-EG")}`}
            </div>
          )}
        </div>
      </div>

      {/* Code Settings Form */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-black text-base" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
          إعداد كود الخصم الخاص بك
        </h3>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          اختر الكود الخاص بك (مثال: <code className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[var(--brand)]">123</code> أو <code className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[var(--brand)]">AHMED10</code>). يتفعل الكود لمدة 350 يوماً من تاريخ إنشائه أو تحديثه.
        </p>

        <form onSubmit={handleSavePromoCode} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label htmlFor="promo-code-input" className="sr-only">
            كود الخصم الخاص بك
          </label>
          <input
            id="promo-code-input"
            type="text"
            required
            aria-label="كود الخصم الخاص بك"
            value={newCodeInput}
            onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
            placeholder="مثال: 123"
            className="px-4 py-2.5 rounded-xl font-mono text-sm uppercase outline-none flex-1 max-w-xs"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink)" }}
          />
          <button
            type="submit"
            disabled={savingCode}
            className="px-6 py-2.5 text-xs font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer border-none"
            style={{ background: "var(--brand)" }}
          >
            {savingCode ? "جارٍ الحفظ..." : "حفظ الكود"}
          </button>
        </form>

        {/* Smart Invite Link Box */}
        {promoCode && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                <span>🔗</span> رابط الدعوة الذكي لطلابك:
              </span>
              <span className="text-[11px] text-[var(--ink-3)]">
                (يتم تعبئة كودك تلقائياً عند فتح الطالب للرابط)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div
                dir="ltr"
                className="px-3.5 py-2 rounded-xl text-xs font-mono truncate flex-1 select-all"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--brand)" }}
              >
                {typeof window !== "undefined"
                  ? `${window.location.origin}/signup?promo=${promoCode}`
                  : `https://code-up.tech/signup?promo=${promoCode}`}
              </div>

              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== "undefined"
                    ? `${window.location.origin}/signup?promo=${promoCode}`
                    : `https://code-up.tech/signup?promo=${promoCode}`;
                  navigator.clipboard.writeText(url);
                  toastSuccess("تم نسخ رابط الدعوة الذكي بنجاح! 📋");
                }}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl transition-all hover:brightness-110 active:scale-95 cursor-pointer border-none flex items-center justify-center gap-1.5"
                style={{ background: "var(--brand)" }}
              >
                <span>📋</span>
                <span>نسخ الرابط</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== "undefined"
                    ? `${window.location.origin}/signup?promo=${promoCode}`
                    : `https://code-up.tech/signup?promo=${promoCode}`;
                  const msg = encodeURIComponent(`مرحباً بك! 👋 سجل الآن على منصة Code-UP عبر هذا الرابط وسيتم تفعيل كود الخصم والإحالة الخاص بي تلقائياً:\n${url}`);
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }}
                className="px-4 py-2 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>💬</span>
                <span>واتساب</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attributions Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-black text-base" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
            سجل الطلاب المحالين وعمليات الشراء
          </h3>
        </div>

        {attributions.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--ink-3)" }}>
            لا توجد مبيعات ناتجة عن كود الإحالة الخاص بك حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--ink-3)" }}>
                  <th className="px-4 py-3 font-medium">اسم الطالب</th>
                  <th className="px-4 py-3 font-medium">نوع العملية</th>
                  <th className="px-4 py-3 font-medium">كود المستعمل</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium text-left">المبلغ المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {attributions.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3 font-bold" style={{ color: "var(--ink)" }}>
                      {a.studentName}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-2)" }}>
                      {a.purchaseType === "SIGNUP"
                        ? "إنشاء حساب"
                        : a.purchaseType === "COURSE"
                        ? "شراء كورس"
                        : a.purchaseType === "FOLDER"
                        ? "شراء محاضرة"
                        : a.purchaseType === "VIDEO"
                        ? "شراء درس"
                        : a.purchaseType === "TEACHER_SUB"
                        ? "اشتراك باقة معلم"
                        : a.purchaseType === "PLAN"
                        ? "شراء خطة دراسية"
                        : a.purchaseType}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--brand)" }}>
                      {a.promoCodeUsed || "إحالة حساب"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--ink-3)" }}>
                      {new Date(a.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-4 py-3 font-black text-left" style={{ color: "var(--brand)" }}>
                      {a.amount > 0 ? `${a.amount.toLocaleString("ar-EG")} ج.م` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
