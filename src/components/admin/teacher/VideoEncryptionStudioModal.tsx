"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { extractYouTubeVideoId } from "@/lib/youtube";
import {
  Video,
  ShieldCheck,
  KeyRound,
  Plus,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export type VideoProviderType = "alasly" | "youtube" | "vdocipher" | "axinom";

interface Props {
  folderId: string;
  folderName: string;
  isOpen: boolean;
  onClose: () => void;
  onVideoCreated: () => void;
}

export function VideoEncryptionStudioModal({
  folderId,
  folderName,
  isOpen,
  onClose,
  onVideoCreated,
}: Props) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [provider, setProvider] = useState<VideoProviderType>("alasly");
  const [title, setTitle] = useState("");
  const [providerVideoId, setProviderVideoId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [maxWatchesPerUser, setMaxWatchesPerUser] = useState<number>(3);
  const [publishAt, setPublishAt] = useState("");
  const [isFree, setIsFree] = useState(false);

  // Security Unlock States (Hidden by default unless unlocked)
  const [vdocipherUnlocked, setVdocipherUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("vdocipher_unlocked"));
  });

  const [drmUnlocked, setDrmUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("drm_unlocked"));
  });

  // "إضافة حماية أخرى" unlock prompt state
  const [showAddSecurityModal, setShowAddSecurityModal] = useState(false);
  const [securityInputCode, setSecurityInputCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Single unified verification for "إضافة حماية أخرى"
  const handleVerifyExtraSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = securityInputCode.trim();
    if (!code) {
      toastError("يرجى إدخال كود أو كلمة مرور الحماية");
      return;
    }

    setCheckingCode(true);
    let unlockedAny = false;

    // Test VdoCipher Gate
    try {
      const resVdo = await fetch("/api/teacher/vdocipher/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      const dataVdo = await resVdo.json();
      if (resVdo.ok && dataVdo.success) {
        setVdocipherUnlocked(true);
        sessionStorage.setItem("vdocipher_unlocked", "true");
        setProvider("vdocipher");
        unlockedAny = true;
        toastSuccess("تم تفعيل نظام VdoCipher Hollywood DRM بنجاح!");
      }
    } catch {
      /* ignore */
    }

    // Test Axinom DRM Gate
    try {
      const resDrm = await fetch("/api/teacher/drm-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      const dataDrm = await resDrm.json();
      if (resDrm.ok && dataDrm.success) {
        setDrmUnlocked(true);
        sessionStorage.setItem("drm_unlocked", "true");
        setProvider("axinom");
        unlockedAny = true;
        toastSuccess("تم تفعيل نظام Axinom Multi-DRM بنجاح!");
      }
    } catch {
      /* ignore */
    }

    setCheckingCode(false);

    if (unlockedAny) {
      setShowAddSecurityModal(false);
      setSecurityInputCode("");
    } else {
      toastError("الكود أو كلمة المرور غير صحيحة. تحقق من الكود وحاول ثانية.");
    }
  };

  // Create Video
  const handleCreateVideo = async (keepOpen = false) => {
    if (!title.trim()) {
      toastError("يرجى كتابة عنوان الفيديو");
      return;
    }
    if (!providerVideoId.trim() && provider !== "alasly") {
      toastError("يرجى إدخال معرّف أو رابط الفيديو");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/folders/${folderId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          videoProvider: provider,
          providerVideoId: providerVideoId.trim(),
          durationMinutes: Number(durationMinutes) || 0,
          maxWatchesPerUser: Number(maxWatchesPerUser) || 3,
          publishAt: publishAt || null,
          isFree,
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        toastSuccess(
          keepOpen
            ? `تمت إضافة الدرس "${title}" بنجاح! جاهز لإضافة الدرس التالي...`
            : `تمت إضافة الدرس بنجاح!`
        );
        onVideoCreated();

        if (keepOpen) {
          setTitle("");
          setProviderVideoId("");
          setIsFree(false);
        } else {
          onClose();
        }
      } else {
        toastError(data.error || "تعذر إضافة الفيديو");
      }
    } catch {
      toastError("حدث خطأ أثناء حفظ الفيديو");
    } finally {
      setSubmitting(false);
    }
  };

  // Always visible providers
  const visibleProviders = [
    {
      id: "alasly" as const,
      name: "Native Secure Engine",
      subname: "مشغل المنصة الفائق (حماية وعلامة مائية رقمية)",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      badge: "دائم ومباشر",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    },
    {
      id: "youtube" as const,
      name: "YouTube",
      subname: "محاضرات يوتيوب (اقتصادي وسريع بدون قيود)",
      icon: <Video className="w-5 h-5 text-blue-500" />,
      badge: "دائم ومباشر",
      badgeColor: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    },
    // Only show VdoCipher if unlocked! (المقفول خبيه)
    ...(vdocipherUnlocked
      ? [
          {
            id: "vdocipher" as const,
            name: "VdoCipher DRM",
            subname: "تشفير هوليوود المتطور ضد التحميل",
            icon: <Sparkles className="w-5 h-5 text-amber-500" />,
            badge: "مفعّل 🔓",
            badgeColor: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          },
        ]
      : []),
    // Only show Axinom if unlocked! (المقفول خبيه)
    ...(drmUnlocked
      ? [
          {
            id: "axinom" as const,
            name: "Axinom Multi-DRM",
            subname: "تشفير سحابي متقدم للأجهزة والتطبيقات",
            icon: <ShieldAlert className="w-5 h-5 text-cyan-500" />,
            badge: "مفعّل 🔓",
            badgeColor: "bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div
        dir="rtl"
        className="relative w-full max-w-xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-xs">
              <Video className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>إضافة فيديو للمحاضرة</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {folderName}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                حدد مشغل الفيديو وخصائص العرض ثم أضف الدرس بضغطة واحدة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* ── 1. Provider Cards (Only Active + Button to Add Extra Security) ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 dark:text-white">
                اختر مشغل الفيديو (Video Provider)
              </label>

              {/* The Requested Button: "إضافة حماية أخرى" */}
              {(!vdocipherUnlocked || !drmUnlocked) && (
                <button
                  type="button"
                  onClick={() => setShowAddSecurityModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="فتح أنظمة التشفير المقفلة (VdoCipher DRM أو Axinom)"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>إضافة حماية أخرى</span>
                </button>
              )}
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {visibleProviders.map((p) => {
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30 shadow-xs ring-1 ring-emerald-500/30"
                        : "border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                          {p.icon}
                        </div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {p.name}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">
                      {p.subname}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Popover / Panel for "إضافة حماية أخرى" ── */}
          {showAddSecurityModal && (
            <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    تفعيل محرك حماية إضافي (VdoCipher DRM أو Axinom)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSecurityModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                أدخل كود الحماية الخاص بـ VdoCipher أو Axinom لفتح المحرك المشفر وإضافته لخياراتك فوراً.
              </p>

              <form onSubmit={handleVerifyExtraSecurity} className="flex gap-2">
                <input
                  type="password"
                  value={securityInputCode}
                  onChange={(e) => setSecurityInputCode(e.target.value)}
                  placeholder="أدخل كود أو كلمة مرور الحماية..."
                  autoFocus
                  className="flex-1 px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={checkingCode}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {checkingCode ? "جارٍ التحقق..." : "تفعيل الحماية"}
                </button>
              </form>
            </div>
          )}

          {/* ── 2. Video Form Fields ── */}
          <div className="space-y-3.5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                عنوان الدرس <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: مقدمة تأسيسية - الجزء الأول"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all font-medium"
              />
            </div>

            {/* Provider Video ID / URL */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                {provider === "youtube" && "رابط أو معرّف فيديو YouTube"}
                {provider === "alasly" && "معرف الفيديو على Native (أو اتركه فارغاً للرفع لاحقاً)"}
                {provider === "vdocipher" && "معرّف فيديو VdoCipher Video ID"}
                {provider === "axinom" && "معرّف فيديو Axinom Asset ID"}
              </label>
              <input
                type="text"
                value={providerVideoId}
                onChange={(e) => setProviderVideoId(e.target.value.trim())}
                placeholder={
                  provider === "youtube"
                    ? "https://www.youtube.com/watch?v=... أو المعرف"
                    : provider === "vdocipher"
                    ? "معرف فيديو VdoCipher"
                    : provider === "axinom"
                    ? "معرف حزمة Axinom"
                    : "معرف الفيديو الداخلي"
                }
                dir="ltr"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              />

              {/* YouTube Verified Live Badge */}
              {provider === "youtube" && providerVideoId && (() => {
                const ytId = extractYouTubeVideoId(providerVideoId);
                if (ytId) {
                  return (
                    <div className="mt-2 p-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>معرف يوتيوب صالح: <code className="font-mono">{ytId}</code></span>
                      </span>
                      <a
                        href={`https://www.youtube.com/watch?v=${ytId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>معاينة</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Duration & Watches */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مدة الدرس (بالدقائق)
                </label>
                <input
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مرات المشاهدة لكل طالب
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={maxWatchesPerUser}
                  onChange={(e) => setMaxWatchesPerUser(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  فتح مجدول (اختياري)
                </label>
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
                />
              </div>
            </div>

            {/* Free Demo Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  درس تجريبي مجاني (Free Preview)
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  متاح للطلاب غير المشتركين لتجربة الشرح
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFree(!isFree)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isFree
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                }`}
              >
                {isFree ? "✅ مجاني" : "❌ مدفوع"}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            {/* The Famous "Add One" Button */}
            <button
              type="button"
              onClick={() => void handleCreateVideo(true)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="إضافة هذا الدرس وإبقاء النموذج لإضافة التالي"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>أضف واحداً (Add One)</span>
            </button>

            {/* Save and Close */}
            <button
              type="button"
              onClick={() => void handleCreateVideo(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>حفظ وإنهاء</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
