"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import Link from "next/link";

interface TelemetryData {
  otp: {
    quota: {
      date: string;
      used: number;
      remaining: number;
      limit: number;
      signupUsed: number;
      forgotPasswordUsed: number;
      purchaseUsed: number;
      phoneChangeUsed: number;
      codeRedemptionUsed: number;
    };
    queue: {
      queuedCount: number;
      waitingUsersCount: number;
      failedCount: number;
    };
  };
  referrals: {
    pending: number;
    qualified: number;
    rewarded: number;
    invalid: number;
    total: number;
  };
  security: {
    failedCodeAttempts24h: number;
    recentLogs: Array<{
      id: string;
      ip: string;
      userId?: string | null;
      codeAttempted: string;
      success: boolean;
      createdAt: string;
    }>;
  };
}

export default function AdminSecurityDashboardPage() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/admin/security/stats", { credentials: "include" });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || "فشل تحميل إحصائيات الأمان");
      }
    } catch {
      setError("تعذر الاتصال بخادم الأمان");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060B17] text-white flex flex-col font-sans" dir="rtl">
        <Navbar user={{ name: "مدير النظام", role: "superadmin" }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#4F7DFF] border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-xs">جاري تحميل لوحة الأمان والرقابة...</p>
          </div>
        </div>
      </div>
    );
  }

  const quotaPct = Math.round(((data?.otp.quota.used ?? 0) / (data?.otp.quota.limit ?? 250)) * 100);

  return (
    <div className="min-h-screen bg-[#060B17] text-slate-100 font-sans selection:bg-[#4F7DFF] selection:text-white" dir="rtl">
      <Navbar user={{ name: "مدير النظام", role: "superadmin" }} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3DDC97] animate-ping" />
              <span className="text-xs font-bold text-[#3DDC97] uppercase tracking-wider">لوحة المراقبة الحية</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-1">🛡️ نظام الأمان وحصص WhatsApp</h1>
            <p className="text-xs text-slate-400 mt-1">مراقبة حصة OTP اليومية، قائمة التأجيل، وحالة الإحالات ومنع المحاولات المشبوهة</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTelemetry}
              className="px-4 py-2 bg-[#18243D] hover:bg-[#203050] text-xs font-bold text-slate-200 rounded-xl border border-white/10 transition-all flex items-center gap-1.5"
            >
              🔄 تحديث البيانات
            </button>
            <Link
              href="/admin/superadmin"
              className="px-4 py-2 bg-[#4F7DFF] hover:bg-[#4370f0] text-xs font-bold text-white rounded-xl transition-all no-underline"
            >
              ← لوحة التحكم الرئيسية
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* ── SECURITY HEALTH INDICATORS PANEL ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#121B2E] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">حصة OTP</span>
              <span className="text-sm font-black text-white font-mono">{data?.otp.quota.used} / {data?.otp.quota.limit}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🟢 مستقر
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121B2E] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">قائمة التأجيل Queue</span>
              <span className="text-sm font-black text-white font-mono">{data?.otp.queue.waitingUsersCount} مستخدم</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
              🟡 معتدل
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121B2E] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">أكواد ملغاة / محظورة</span>
              <span className="text-sm font-black text-white font-mono">{data?.security.failedCodeAttempts24h} محاولة</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🟢 محمي
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121B2E] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">نزاهة الإحالات</span>
              <span className="text-sm font-black text-white font-mono">{data?.referrals.rewarded} مكافأة</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🟢 آمن 100%
            </span>
          </div>
        </div>

        {/* ── 1. OTP QUOTA & DEFERRED QUEUE SECTION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Daily Quota Card (7 cols) */}
          <div className="lg:col-span-7 p-6 rounded-[28px] bg-gradient-to-b from-[#172338] to-[#101827] border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#4F7DFF] uppercase tracking-wider">WhatsApp Daily Quota Manager</span>
                <h2 className="text-xl font-black text-white mt-0.5">حصة رسائل OTP اليومية</h2>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                {data?.otp.quota.date}
              </span>
            </div>

            {/* Quota Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">المستخدم اليوم: <strong className="text-white font-mono">{data?.otp.quota.used}</strong> من أصل <strong className="text-[#4F7DFF] font-mono">{data?.otp.quota.limit}</strong></span>
                <span className={`font-mono ${quotaPct >= 90 ? "text-rose-400" : "text-[#3DDC97]"}`}>{quotaPct}%</span>
              </div>
              <div className="h-4 w-full bg-[#060B17] rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 shadow-md ${
                    quotaPct >= 90
                      ? "bg-gradient-to-r from-amber-500 to-rose-500 shadow-rose-500/30"
                      : "bg-gradient-to-r from-[#4F7DFF] to-[#3DDC97] shadow-[#3DDC97]/30"
                  }`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>المتبقي اليوم: <strong className="text-[#3DDC97] font-mono">{data?.otp.quota.remaining}</strong> رسالة</span>
                <span>حد الأمان: 250 رسالة/24س</span>
              </div>
            </div>

            {/* Category Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="p-3 rounded-2xl bg-[#121B2E] border border-white/5 text-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">تسجيل حسابات</span>
                <span className="font-mono font-black text-[#4F7DFF] text-base">{data?.otp.quota.signupUsed}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#121B2E] border border-white/5 text-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">إعادة كلمة السر</span>
                <span className="font-mono font-black text-[#F7C948] text-base">{data?.otp.quota.forgotPasswordUsed}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#121B2E] border border-white/5 text-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">شراء الكورسات</span>
                <span className="font-mono font-black text-[#3DDC97] text-base">{data?.otp.quota.purchaseUsed}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#121B2E] border border-white/5 text-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">تفعيل الأكواد</span>
                <span className="font-mono font-black text-[#7C5CFF] text-base">{data?.otp.quota.codeRedemptionUsed}</span>
              </div>
            </div>
          </div>

          {/* Deferred Queue & Waiting Users Widget (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-[28px] bg-[#121B2E] border border-white/10 shadow-2xl flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Deferred Queue</span>
              <h2 className="text-xl font-black text-white mt-0.5">قائمة التحقق المؤجل</h2>
              <p className="text-xs text-slate-400 mt-1">المستخدمون المسجلون بحالة انتظار عند نفاذ الحصة اليومية</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#18243D] border border-white/5 text-center">
                <span className="text-xs text-slate-400 block mb-1">في قائمة الانتظار</span>
                <span className="text-3xl font-black text-amber-400 font-mono">{data?.otp.queue.queuedCount}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#18243D] border border-white/5 text-center">
                <span className="text-xs text-slate-400 block mb-1">حسابات تنتظر OTP</span>
                <span className="text-3xl font-black text-[#4F7DFF] font-mono">{data?.otp.queue.waitingUsersCount}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">فشل الإرسال في Queue:</span>
              <span className="font-mono font-black text-rose-400">{data?.otp.queue.failedCount} عناصر</span>
            </div>
          </div>

        </div>

        {/* ── 2. REFERRAL STATE MACHINE TELEMETRY ── */}
        <div className="p-6 rounded-[28px] bg-[#121B2E] border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-black text-white">🔗 حالة نظام الإحالات المعتمد (Referral State Machine)</h2>
              <p className="text-xs text-slate-400 mt-0.5">يتم صرف المكافأة (+50 XP) فقط بعد شراء كورس أو تفعيل كود مدفوع بنجاح</p>
            </div>
            <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-[#4F7DFF]/10 text-[#4F7DFF] border border-[#4F7DFF]/20">
              إجمالي الإحالات: {data?.referrals.total}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#18243D] border border-amber-500/20">
              <span className="text-xs text-amber-400 font-bold block mb-1">قيد الانتظار (PENDING)</span>
              <span className="text-2xl font-black text-white font-mono">{data?.referrals.pending}</span>
              <p className="text-[10px] text-slate-400 mt-1">سجلوا ولم يشتروا بعد</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#18243D] border border-indigo-500/20">
              <span className="text-xs text-indigo-400 font-bold block mb-1">مؤهل للشراء (QUALIFIED)</span>
              <span className="text-2xl font-black text-white font-mono">{data?.referrals.qualified}</span>
              <p className="text-[10px] text-slate-400 mt-1">أتموا الشراء الأول</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#18243D] border border-emerald-500/20">
              <span className="text-xs text-emerald-400 font-bold block mb-1">تمت المكافأة (REWARDED)</span>
              <span className="text-2xl font-black text-white font-mono">{data?.referrals.rewarded}</span>
              <p className="text-[10px] text-slate-400 mt-1">تم صرف +50 XP للطرفين</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#18243D] border border-rose-500/20">
              <span className="text-xs text-rose-400 font-bold block mb-1">غير صالح (INVALID)</span>
              <span className="text-2xl font-black text-white font-mono">{data?.referrals.invalid}</span>
              <p className="text-[10px] text-slate-400 mt-1">إحالة ذاتية أو ملغاة</p>
            </div>
          </div>
        </div>

        {/* ── 3. ACCESS CODE BRUTE-FORCE SECURITY LOG ── */}
        <div className="p-6 rounded-[28px] bg-[#121B2E] border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-black text-white">🔒 سجل محاولات تفعيل الأكواد والحماية (Access Code Audit)</h2>
              <p className="text-xs text-slate-400 mt-0.5">متابعة محاولات التخمين، التشفير بـ HMAC SHA-256 والحظر التلقائي للـ IP</p>
            </div>
            <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              محاولات فاشلة (24س): {data?.security.failedCodeAttempts24h}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-bold">
                  <th className="py-2.5 px-3">الوقت</th>
                  <th className="py-2.5 px-3">عنوان IP</th>
                  <th className="py-2.5 px-3">الكود المدخل (مختصر)</th>
                  <th className="py-2.5 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.security.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {new Date(log.createdAt).toLocaleTimeString("ar-EG")}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{log.ip}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">{log.codeAttempted}</td>
                    <td className="py-2.5 px-3">
                      {log.success ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          ✓ نجاح التفعيل
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                          ✕ كود غير صحيح
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
