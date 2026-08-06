"use client";

import { useEffect, useState } from "react";

export function WhatsAppSection() {
  const [activeTab, setActiveTab] = useState<"providers" | "logs" | "templates" | "settings">("providers");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // Config Form State
  const [deliveryMode, setDeliveryMode] = useState<string>("baileys_primary");
  const [baileysTemplate, setBaileysTemplate] = useState<string>("");
  const [autoSendParent, setAutoSendParent] = useState<boolean>(true);
  const [requireParentVerif, setRequireParentVerif] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Test Message Form State
  const [testPhone, setTestPhone] = useState("");
  const [testContent, setTestContent] = useState("تجربة إرسال رسالة من منصة Code-UP عبر الواتساب 🚀");
  const [testType, setTestType] = useState("CUSTOM");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProvider) params.set("provider", filterProvider);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("messageType", filterType);

      const res = await fetch(`/api/admin/whatsapp?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setDeliveryMode(json.activeDeliveryMode || "baileys_primary");
        setBaileysTemplate(json.baileysOtpTemplate || "");
        setAutoSendParent(json.autoSendParentPortal ?? true);
        setRequireParentVerif(json.requireParentVerification ?? false);
        setError(null);
      } else {
        setError(json.error || "فشل تحميل بيانات مركز الواتساب");
      }
    } catch (err: any) {
      setError(err?.message || "خطأ في الاتصال بالشبكة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [search, filterProvider, filterStatus, filterType]);

  const handleSaveConfig = async (override?: any) => {
    setSavingConfig(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          deliveryMode: override?.deliveryMode ?? deliveryMode,
          baileysOtpTemplate: override?.baileysOtpTemplate ?? baileysTemplate,
          autoSendParentPortal: override?.autoSendParentPortal ?? autoSendParent,
          requireParentVerification: override?.requireParentVerification ?? requireParentVerif,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchStatus();
      } else {
        alert(json.error || "فشل حفظ الإعدادات");
      }
    } catch (e: any) {
      alert("خطأ أثناء الاتصال بالخادم");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || !testContent) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-send",
          phone: testPhone,
          content: testContent,
          messageType: testType,
        }),
      });
      const json = await res.json();
      setTestResult(json);
      fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || "خطأ في الإرسال" });
    } finally {
      setTestSending(false);
    }
  };

  const handleAction = async (action: "reconnect" | "logout") => {
    if (action === "logout" && !confirm("هل أنت تأكد من تسجيل الخروج ومسح جلسة Baileys؟ ستضطر لمسح الـ QR مجدداً.")) {
      return;
    }
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      alert(json.message || "تم تنفيذ الإجراء");
      fetchStatus();
    } catch {
      alert("حدث خطأ أثناء الاتصال");
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/admin/whatsapp?export=csv`, "_blank");
  };

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm">جاري تحميل مركز إدارة الواتساب المتقدم...</p>
      </div>
    );
  }

  const baileys = data?.providers?.baileys;
  const meta = data?.providers?.officialApi;
  const daily = data?.dailyUsage;
  const logs = data?.logs || [];
  const configLogs = data?.configLogs || [];

  // Official Meta API Quota Calculations
  const metaTotalToday = daily?.officialApi?.totalCount || 0;
  const metaLimit = 1000;
  const metaPercent = Math.min(100, Math.round((metaTotalToday / metaLimit) * 100));
  let progressColor = "bg-emerald-500";
  if (metaPercent >= 90) progressColor = "bg-rose-500";
  else if (metaPercent >= 70) progressColor = "bg-amber-500";

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>💬 مركز إدارة وتوزيع الواتساب V2</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Dual-Provider Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إدارة كاملة لمحرك Baileys و Meta Business API الرسمي، التحويل التلقائي عند الأعطال، وروابط بوابة ولي الأمر.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "providers" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            🔌 المزودات والإستراتيجية
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "logs" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📋 السجلات والنشاط ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "templates" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📝 القوالب و الـ OTP
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "settings" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            ⚙️ إعدادات ولي الأمر والاختبار
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* TAB 1: PROVIDERS & DELIVERY STRATEGY */}
      {activeTab === "providers" && (
        <div className="space-y-6">
          {/* Dual Providers Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Provider 1: Baileys Card */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl">
                    🟢
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">مزود 1: Baileys Socket Engine</h3>
                    <p className="text-xs text-slate-400">محرك إرسال مباشر وسريع عبر واتساب ويب</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-bold border ${baileys?.connected ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}>
                  {baileys?.statusText || "جاري التقييم..."}
                </span>
              </div>

              {/* Baileys Health Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">إجمالي اليوم</p>
                  <p className="text-lg font-bold text-white mt-0.5">{daily?.baileys?.totalCount || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">تم التسليم</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{daily?.baileys?.deliveredCount || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">أكواد OTP اليوم</p>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">{daily?.baileys?.otpCount || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">فشل الإرسال</p>
                  <p className="text-lg font-bold text-rose-400 mt-0.5">{daily?.baileys?.failedCount || 0}</p>
                </div>
              </div>

              {/* Detailed Health Telemetry */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span>⏱️ متوسط زمن الاستجابة (Latency):</span>
                  <span className="font-mono text-emerald-400 font-bold">{baileys?.health?.avgResponseLatencyMs || 120}ms</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>📦 طابور الانتظار (Queue):</span>
                  <span className="font-mono text-sky-400 font-bold">{baileys?.health?.queueDepth || 0} رسالة</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                  <span>آخر إرسال ناجح:</span>
                  <span>{baileys?.health?.lastSuccessfulSend ? new Date(baileys.health.lastSuccessfulSend).toLocaleTimeString("ar-EG") : "لا يوجد مؤخراً"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleAction("reconnect")}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  🔄 إعادة الاتصال بالخادم
                </button>
                <button
                  onClick={() => handleAction("logout")}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
                >
                  🚪 خروج
                </button>
              </div>
            </div>

            {/* Provider 2: Official Meta API Card */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-xl">
                    🌐
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">مزود 2: Official Meta WhatsApp Business API</h3>
                    <p className="text-xs text-slate-400">واجهة ميتا الرسمية لإرسال القوالب والأكواد الموثوقة</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-bold border ${meta?.connected ? "bg-sky-500/15 border-sky-500/30 text-sky-400" : "bg-amber-500/15 border-amber-500/30 text-amber-400"}`}>
                  {meta?.statusText || "معطّل"}
                </span>
              </div>

              {/* Daily Quota Progress Bar */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">📊 استهلاك الكوتا اليومية (Meta Daily Limit)</span>
                  <span className="font-mono font-bold text-sky-400">{metaTotalToday} / {metaLimit}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${progressColor}`}
                    style={{ width: `${metaPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-left dir-ltr">{metaPercent}% used today</p>
              </div>

              {/* Official Meta Message Categories Breakdown */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Authentication</p>
                  <p className="text-base font-bold text-sky-400 mt-0.5">{daily?.officialApi?.authCount || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Utility Messages</p>
                  <p className="text-base font-bold text-emerald-400 mt-0.5">{daily?.officialApi?.utilityCount || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Marketing</p>
                  <p className="text-base font-bold text-purple-400 mt-0.5">{daily?.officialApi?.marketingCount || 0}</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                🔒 يتم حفظ رموز مفاتيح Meta API بأمان داخل ملف <code className="text-amber-300 font-mono">.env</code> على السيرفر (META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID).
              </div>
            </div>
          </div>

          {/* Delivery Strategy Configuration Card */}
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>⚡ إستراتيجية الإرسال والتحويل التلقائي (Delivery Strategy & Automatic Failover)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  اختر المزود الأساسي وطريقة التحويل عند الانقطاع أو تجاوز الحدود اليومية.
                </p>
              </div>
              {saveSuccess && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                  ✓ تم حفظ الإستراتيجية وتسجيل السجل!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: "baileys_primary",
                  title: "⚡ Baileys الأساسي (مع Meta للتحويل)",
                  desc: "يتم استخدام Baileys أولاً للسرعة مجاناً، وتحويل الرسالة تلقائياً لـ Meta API في حال فشل الإرسال.",
                },
                {
                  id: "official_primary",
                  title: "🛡️ Meta API الأساسي (مع Baileys للتحويل)",
                  desc: "يتم استخدام واجهة ميتا الرسمية أولاً لضمان التسليم، والتحويل إلى Baileys عند استهلاك الكوتا.",
                },
                {
                  id: "baileys_only",
                  title: "📱 Baileys فقط",
                  desc: "اعتماد كلي على محرك Baileys المباشر بدون استخدام واجهة ميتا.",
                },
                {
                  id: "official_only",
                  title: "🌐 Official Meta API فقط",
                  desc: "اعتماد كلي على واجهة ميتا الرسمية فقط بدون استخدام Baileys.",
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    setDeliveryMode(opt.id);
                    handleSaveConfig({ deliveryMode: opt.id });
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    deliveryMode === opt.id
                      ? "border-emerald-500 bg-emerald-500/10 text-white shadow-lg"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      checked={deliveryMode === opt.id}
                      onChange={() => {}}
                      className="accent-emerald-500"
                    />
                    <span className="font-bold text-xs">{opt.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ACTIVITY & AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base">📋 سجلات إرسال الرسائل الحية (Audit Logs)</h3>
                <p className="text-xs text-slate-400 mt-0.5">تتبع كامل لجميع الرسائل الصادرة والنتائج وأسباب الفشل.</p>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  📥 تصدير ملف CSV
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold border border-sky-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  🖨️ طباعة / PDF
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم الهاتف أو المحتوى..."
                className="bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs focus:border-emerald-500 outline-none"
              />
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs focus:border-emerald-500 outline-none"
              >
                <option value="">جميع المزودات</option>
                <option value="BAILEYS">Baileys Engine</option>
                <option value="OFFICIAL_API">Official Meta API</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs focus:border-emerald-500 outline-none"
              >
                <option value="">جميع الحالات</option>
                <option value="DELIVERED">تم التسليم (DELIVERED)</option>
                <option value="FAILED">فشل (FAILED)</option>
                <option value="PENDING">في الانتظار (PENDING)</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs focus:border-emerald-500 outline-none"
              >
                <option value="">جميع أنواع الرسائل</option>
                <option value="OTP">أكواد OTP</option>
                <option value="PARENT_LINK">رابط ولي الأمر</option>
                <option value="NOTIFICATION">إشعارات</option>
                <option value="CUSTOM">رسائل مخصصة</option>
              </select>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">الوقت</th>
                    <th className="p-3">المستلم</th>
                    <th className="p-3">المزود</th>
                    <th className="p-3">نوع الرسالة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">زمن الاستجابة</th>
                    <th className="p-3">المحتوى / الخطأ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        لا توجد سجلات مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-slate-400 font-mono dir-ltr">
                          {new Date(log.createdAt).toLocaleTimeString("ar-EG")}
                        </td>
                        <td className="p-3 font-mono font-bold text-white dir-ltr">{log.recipient}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${log.provider === "BAILEYS" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`}>
                            {log.provider}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {log.messageType}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${log.status === "DELIVERED" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{log.deliveryTimeMs || 0}ms</td>
                        <td className="p-3 max-w-xs truncate text-slate-400">
                          {log.errorMessage ? (
                            <span className="text-rose-400 font-bold">{log.errorMessage}</span>
                          ) : (
                            log.content
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Configuration Change Audit Logs */}
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-base">🛡️ سجل تعديلات إعدادات الواتساب (Configuration Audit Log)</h3>
            <div className="space-y-2">
              {configLogs.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد تغييرات مسجلة مؤخراً.</p>
              ) : (
                configLogs.map((cl: any) => (
                  <div key={cl.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-400">{cl.adminName}</span> قامت بتعديل الإعداد <code className="text-sky-300 font-mono">{cl.settingKey}</code>
                      {cl.oldValue && <span className="text-slate-400"> من ({cl.oldValue})</span>} إلى <span className="text-white font-bold">({cl.newValue})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono dir-ltr">{new Date(cl.createdAt).toLocaleString("ar-EG")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATES & OTP EDITOR */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Baileys OTP Template Editor */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">📝 محرر قالب كود التحقق (Baileys OTP Template Editor)</h3>
                <p className="text-xs text-slate-400 mt-0.5">قم بتعديل صيغة الرسالة التي تصل للطلاب عند طلب كود التحقق.</p>
              </div>

              {/* Variables Quick Insert Chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">انقر لإضافة المتغيرات المتاحة:</label>
                <div className="flex flex-wrap gap-2">
                  {["{{studentName}}", "{{otp}}", "{{minutes}}", "{{school}}"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBaileysTemplate((prev) => prev + " " + v)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono transition-all cursor-pointer"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={7}
                value={baileysTemplate}
                onChange={(e) => setBaileysTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl text-xs font-mono outline-none focus:border-emerald-500 leading-relaxed"
                placeholder="أدخل قالب الرسالة هنا..."
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveConfig()}
                  disabled={savingConfig}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  {savingConfig ? "جاري الحفظ..." : "💾 حفظ القالب"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const def = `🔐 Code-UP\n\nمرحباً {{studentName}}\n\nرمز التحقق الخاص بك هو:\n\n{{otp}}\n\nهذا الرمز صالح لمدة {{minutes}} دقائق.\n\nيرجى عدم مشاركة هذا الرمز مع أي شخص.\n\nشكراً لاستخدام منصة Code-UP.`;
                    setBaileysTemplate(def);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  ↺ استعادة الافتراضي
                </button>
              </div>
            </div>

            {/* Live Mobile WhatsApp Message Preview */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">📱 معاينة حية لشاشة واتساب الطالب (Live Preview)</h3>
                <p className="text-xs text-slate-400 mt-0.5">هكذا ستظهر الرسالة للطالب مباشرة على هاتف الموبايل.</p>
              </div>

              {/* Chat Bubble Card */}
              <div className="p-4 rounded-2xl bg-[#0b141a] border border-slate-800 space-y-2 min-h-[220px]">
                <div className="bg-[#202c33] text-white p-3.5 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap shadow-md font-sans">
                  {baileysTemplate
                    .replace(/{{studentName}}/g, "أحمد محمد")
                    .replace(/{{otp}}/g, "583921")
                    .replace(/{{minutes}}/g, "5")
                    .replace(/{{school}}/g, "Code-UP") || "القالب فارغ"}
                  <div className="text-[10px] text-slate-400 text-left mt-2 dir-ltr">10:42 PM ✓✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARENT LINK SETTINGS & TEST SEND */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Parent Link Settings */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">👨‍👩‍👧‍👦 إعدادات رابط ولي الأمر والتحقق</h3>
                <p className="text-xs text-slate-400 mt-0.5">التحكم في الإرسال التلقائي واشتراط التحقق لولي الأمر.</p>
              </div>

              <div className="space-y-4">
                {/* Toggle 1: Auto-send Parent Portal */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-xs text-white">إرسال رابط بوابة ولي الأمر تلقائياً</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      عند إنشاء حساب طالب جديد وإدخال رقم ولي الأمر، يتم توليد وإرسال رابط البوابة لمرة واحدة تلقائياً.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const val = !autoSendParent;
                      setAutoSendParent(val);
                      handleSaveConfig({ autoSendParentPortal: val });
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoSendParent ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoSendParent ? "left-1" : "left-6"}`} />
                  </button>
                </div>

                {/* Toggle 2: Require Parent Verification */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-xs text-white">اشتراط تأكيد ولي الأمر عبر OTP</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يبقى حساب الطالب معلقاً (Pending) حتى يقوم ولي الأمر بتأكيد حسابه عبر كود OTP يرسل لواتساب ولي الأمر.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const val = !requireParentVerif;
                      setRequireParentVerif(val);
                      handleSaveConfig({ requireParentVerification: val });
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${requireParentVerif ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${requireParentVerif ? "left-1" : "left-6"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Test Message Generator */}
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">🚀 إرسال رسالة اختبار مخصصة (Test Send)</h3>
                <p className="text-xs text-slate-400 mt-0.5">اختبار فوري لأداء المحرك وزمن الاستجابة لمسار الإرسال.</p>
              </div>

              <form onSubmit={handleTestSend} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف (E.164)</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع الرسالة الاختبارية</label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3.5 py-2 rounded-xl text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="CUSTOM">رسالة مخصصة (Custom Text)</option>
                    <option value="OTP">رمز كود تحقق (OTP)</option>
                    <option value="PARENT_LINK">رابط بوابة ولي الأمر (Parent Link)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">محتوى الرسالة</label>
                  <textarea
                    rows={3}
                    value={testContent}
                    onChange={(e) => setTestContent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testSending}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md"
                >
                  {testSending ? "جاري الإرسال الاختبار..." : "🚀 إرسال الآن واختبار المحرك"}
                </button>
              </form>

              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-1 ${testResult.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
                  <p className="font-bold">{testResult.success ? "✓ تم الإرسال بنجاح!" : "❌ فشل الإرسال"}</p>
                  {testResult.result && (
                    <>
                      <p>المزود المستخدم: {testResult.result.provider}</p>
                      <p>زمن الاستجابة: {testResult.result.deliveryTimeMs}ms</p>
                      {testResult.result.messageId && <p>Message ID: {testResult.result.messageId}</p>}
                    </>
                  )}
                  {testResult.error && <p>الخطأ: {testResult.error}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
