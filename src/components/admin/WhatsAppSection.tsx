"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface WhatsAppStatusData {
  connected: boolean;
  state: "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED";
  user: { jid: string; name?: string; phone?: string } | null;
  qrCodeDataUrl: string | null;
  uptimeSeconds: number;
  connectedAt: string | null;
  queueLength: number;
}

export function WhatsAppSection() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [status, setStatus] = useState<WhatsAppStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Test message modal / form state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.status) {
        setStatus(data.status);
      }
    } catch {
      // Ignore background poll error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    // Live polling every 3 seconds for seamless QR scan status updates
    const timer = setInterval(() => {
      void fetchStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handleReconnect = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconnect" }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "جارٍ إعادة الاتصال...");
        void fetchStatus();
      } else {
        toastError(data.error || "فشلت عملية إعادة الاتصال");
      }
    } catch {
      toastError("تعذر الاتصال بالسيرفر");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("هل أنت تأكد من تسجيل الخروج وتصفير الجلسة؟ سيتطلب إرسال الرسائل مسح كود QR جديد.")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "تم تسجيل الخروج بنجاح");
        void fetchStatus();
      } else {
        toastError(data.error || "فشلت عملية تسجيل الخروج");
      }
    } catch {
      toastError("تعذر الاتصال بالسيرفر");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      toastError("يرجى إدخال رقم الهاتف ونص الرسالة");
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-send", phone: testPhone.trim(), message: testMessage.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "تمت إضافة الرسالة إلى طابور الإرسال!");
        setTestMessage("");
        void fetchStatus();
      } else {
        toastError(data.error || "فشل إرسال الرسالة الاختبارية");
      }
    } catch {
      toastError("تعذر الاتصال بالسيرفر");
    } finally {
      setTestSending(false);
    }
  };

  function formatUptime(seconds: number): string {
    if (seconds <= 0) return "الآن";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days} يوم و ${hours} ساعة`;
    if (hours > 0) return `${hours} ساعة و ${mins} دقيقة`;
    return `${mins} دقيقة`;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-2xl skeleton" />
        <div className="h-64 rounded-2xl skeleton" />
      </div>
    );
  }

  const isConnected = status?.connected === true;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--ink)] flex items-center gap-2">
            <span>💬</span> إدارة خدمة WhatsApp (Baileys)
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-0.5">
            ربط الحساب وتتبع طابور الإرسال وتأكيد وصول أكواد التحقق (OTP) للطلاب عبر الـ WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReconnect}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] text-xs font-bold hover:bg-[var(--border)] transition-colors disabled:opacity-50"
          >
            {actionLoading ? "جارٍ التحديث..." : "🔄 إعادة الاتصال"}
          </button>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isConnected ? "🟢" : "🔴"}</span>
            <div>
              <h3 className="font-bold text-base text-[var(--ink)]">
                {isConnected ? "متصل بنجاح (Connected)" : "غير متصل (Not Connected)"}
              </h3>
              <p className="text-xs text-[var(--ink-muted)]">
                حالة المحرك: <span className="font-mono font-bold text-sky-400">{status?.state || "DISCONNECTED"}</span>
              </p>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleLogout}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition-colors"
            >
              تسجيل الخروج
            </button>
          )}
        </div>

        {/* Connected Details */}
        {isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">📱 الهاتف المقترن</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {status?.user?.phone || status?.user?.jid?.split("@")[0] || "غير محدد"}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">⏱️ مدة الاتصال</span>
              <span className="text-base font-black text-[var(--ink)]">
                {formatUptime(status?.uptimeSeconds || 0)}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">📬 طابور الرسائل (Queue)</span>
              <span className="text-base font-black font-mono text-sky-400">
                {status?.queueLength ?? 0} رسالة
              </span>
            </div>
          </div>
        ) : (
          /* Unconnected / QR Pairing Box */
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            {status?.qrCodeDataUrl ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-amber-400 animate-pulse">
                  📷 امسح كود الـ QR التالي من تطبيق WhatsApp على هاتفك للاقتران:
                </p>
                <div className="p-3 bg-white rounded-2xl inline-block shadow-lg border-4 border-emerald-500/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={status.qrCodeDataUrl} alt="WhatsApp QR Code" className="w-64 h-64 mx-auto" />
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  افتح WhatsApp ➔ الأجهزة المقترنة (Linked Devices) ➔ ربط جهاز (Link a Device)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[var(--ink-muted)]">جارٍ تجهيز كود الاقتران أو المحرك يعيد محاولة الاتصال تلقائياً...</p>
                <button
                  onClick={handleReconnect}
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors"
                >
                  بدء محاولة الاتصال وتوليد QR
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Message Sending Box */}
      {isConnected && (
        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
          <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
            <span>🚀</span> إرسال رسالة اختبارية (Test Message)
          </h3>
          <form onSubmit={handleSendTestMessage} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">رقم الهاتف (E.164)</label>
                <input
                  type="text"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:border-sky-400"
                  placeholder="201012345678"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">نص الرسالة</label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-sky-400"
                  placeholder="تجربة إرسال رسالة عبر محرك Code-UP WhatsApp..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={testSending}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-colors disabled:opacity-50"
            >
              {testSending ? "جارٍ الإضافة لطابور الإرسال..." : "إرسال إلى الطابور"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
