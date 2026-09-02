"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { BananaKeySvg } from "@/components/admin/AdminActionPasswordBar";
import {
  Video,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Plus,
  X,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export type VideoProviderType = "alasly" | "youtube" | "vdocipher" | "axinom" | "bunny";

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

  // Security Unlock States
  const [vdocipherUnlocked, setVdocipherUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("vdocipher_unlocked"));
  });
  const [vdocipherPassword, setVdocipherPassword] = useState("");
  const [unlockingVdo, setUnlockingVdo] = useState(false);

  const [drmUnlocked, setDrmUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("drm_unlocked"));
  });
  const [drmPassword, setDrmPassword] = useState("");
  const [unlockingDrm, setUnlockingDrm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Unlock VdoCipher DRM
  const handleUnlockVdoCipher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vdocipherPassword.trim()) {
      toastError("أدخل كلمة مرور أمان VdoCipher");
      return;
    }
    setUnlockingVdo(true);
    try {
      const res = await fetch("/api/teacher/vdocipher/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: vdocipherPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess("تم تفعيل أعلى درجات التشفير VdoCipher DRM بنجاح!");
        setVdocipherUnlocked(true);
        sessionStorage.setItem("vdocipher_unlocked", "true");
        setProvider("vdocipher");
      } else {
        toastError(data.error || "كلمة مرور VdoCipher غير صحيحة");
      }
    } catch {
      toastError("تعذر التحقق من كلمة المرور");
    } finally {
      setUnlockingVdo(false);
    }
  };

  // Unlock Axinom Multi-DRM
  const handleUnlockAxinom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drmPassword.trim()) {
      toastError("أدخل كلمة مرور حماية Multi-DRM");
      return;
    }
    setUnlockingDrm(true);
    try {
      const res = await fetch("/api/teacher/drm-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: drmPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess("تم تفعيل نظام Axinom Multi-DRM بنجاح!");
        setDrmUnlocked(true);
        sessionStorage.setItem("drm_unlocked", "true");
        setProvider("axinom");
      } else {
        toastError(data.error || "كلمة مرور الـ DRM غير صحيحة");
      }
    } catch {
      toastError("تعذر الاتصال بالخادم");
    } finally {
      setUnlockingDrm(false);
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
          drmPassword: drmPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        toastSuccess(keepOpen ? `تمت إضافة الدرس "${title}" بنجاح! جاهز لإضافة الدرس التالي...` : `تمت إضافة الدرس بنجاح!`);
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

  // Provider Tiers Definition
  const providers = [
    {
      id: "alasly" as const,
      name: "Native Secure Engine",
      subname: "مشغل المنصة الفائق (حماية عالية ومباشرة)",
      badge: "دائم ومفعّل دائماً",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      alwaysActive: true,
      description: "مشغل HTML5 داخلي سريع مع علامات مائية رقمية متحركة برقم هاتف الطالب وحظر تسجيل الشاشة.",
    },
    {
      id: "youtube" as const,
      name: "YouTube Integration",
      subname: "محاضرات يوتيوب (اقتصادي وسريع)",
      badge: "دائم ومفعّل دائماً",
      badgeColor: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      icon: <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      alwaysActive: true,
      description: "ضع أي رابط أو معرّف يوتيوب. مناسب للشروحات العامة والمحاضرات المجانية بدون استهلاك سيرفرات.",
    },
    {
      id: "vdocipher" as const,
      name: "VdoCipher Hollywood DRM",
      subname: "أعلى درجات التشفير ضد التحميل والتسريب",
      badge: vdocipherUnlocked ? "مفتوح ومفعّل 🔓" : "يتطلب كلمة سر 🔒",
      badgeColor: vdocipherUnlocked
        ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
        : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
      icon: vdocipherUnlocked ? (
        <Unlock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      ),
      alwaysActive: false,
      isUnlocked: vdocipherUnlocked,
      description: "تشفير استوديوهات هوليوود (Widevine L1 & FairPlay DRM). يمنع التحميل بأي برنامج منعاً باتاً.",
    },
    {
      id: "axinom" as const,
      name: "Axinom Multi-DRM",
      subname: "تشفير سحابي متقدم للأجهزة والتطبيقات",
      badge: drmUnlocked ? "مفتوح ومفعّل 🔓" : "يتطلب كلمة سر 🔒",
      badgeColor: drmUnlocked
        ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
        : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
      icon: drmUnlocked ? (
        <Unlock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
      ) : (
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      ),
      alwaysActive: false,
      isUnlocked: drmUnlocked,
      description: "نظام Multi-DRM السحابي المتوافق مع شاشات التابلت والتطبيقات والأنظمة التعليمية المقفلة.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div
        dir="rtl"
        className="relative w-full max-w-2xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-sm">
              <BananaKeySvg className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>استوديو تشفير وإضافة الفيديو</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {folderName}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                اختر مستوى التشفير المطلوب وحدد خصائص الدرس ثم أضف الفيديو بضغطة واحدة.
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
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* ── 1. Encryption / Protection Tier Selector ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>اختر محرك التشفير ومستوى الحماية (Encryption Tier)</span>
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Native و YouTube متاحان دائماً
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providers.map((p) => {
                const isSelected = provider === p.id;
                const isLocked = !p.alwaysActive && !p.isUnlocked;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setProvider(p.id);
                      } else {
                        setProvider(p.id);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/20"
                        : "border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                          {p.icon}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {p.subname}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                        {p.badge}
                      </span>
                    </div>

                    <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 2. Locked Tier Unlock Panels (If selected provider is locked) ── */}
          {provider === "vdocipher" && !vdocipherUnlocked && (
            <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/80 dark:border-amber-800/80 dark:bg-amber-950/30 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200">
                    فتح أعلى درجات التشفير VdoCipher Hollywood DRM
                  </h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    أدخل كلمة مرور المشرف لفك القفل وإتاحة رفع فيديوهات VdoCipher المشفرة.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUnlockVdoCipher} className="flex gap-2">
                <input
                  type="password"
                  value={vdocipherPassword}
                  onChange={(e) => setVdocipherPassword(e.target.value)}
                  placeholder="كلمة مرور VdoCipher..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-amber-300 bg-white dark:bg-slate-900 dark:border-amber-700 text-xs font-mono text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={unlockingVdo}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{unlockingVdo ? "جارٍ الفك..." : "تفعيل VdoCipher"}</span>
                </button>
              </form>
            </div>
          )}

          {provider === "axinom" && !drmUnlocked && (
            <div className="p-4 rounded-2xl border border-cyan-300 bg-cyan-50/80 dark:border-cyan-800/80 dark:bg-cyan-950/30 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <h4 className="text-xs font-black text-cyan-900 dark:text-cyan-200">
                    فتح نظام Axinom Multi-DRM
                  </h4>
                  <p className="text-[11px] text-cyan-700 dark:text-cyan-400">
                    أدخل كلمة مرور حماية الـ DRM لإتاحة ربط ورفع حزم التشفير السحابية.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUnlockAxinom} className="flex gap-2">
                <input
                  type="password"
                  value={drmPassword}
                  onChange={(e) => setDrmPassword(e.target.value)}
                  placeholder="كلمة مرور Multi-DRM..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-cyan-300 bg-white dark:bg-slate-900 dark:border-cyan-700 text-xs font-mono text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={unlockingDrm}
                  className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{unlockingDrm ? "جارٍ الفك..." : "تفعيل Axinom"}</span>
                </button>
              </form>
            </div>
          )}

          {/* ── 3. Video Details Form ── */}
          <div className="space-y-4 pt-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                عنوان الدرس أو المحاضرة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: الدرس الأول - مقدمة وتأسيس شامل"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all font-medium"
              />
            </div>

            {/* Provider Video ID / URL */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                {provider === "youtube" && "رابط أو معرّف فيديو YouTube (يدعم youtu.be / youtube.com)"}
                {provider === "alasly" && "معرف الفيديو على Native Engine (أو اتركه إن كنت سترفعه لاحقاً)"}
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
                    ? "مثال: e2179836a94b4..."
                    : provider === "axinom"
                    ? "مثال: lesson_101_pkg"
                    : "معرف درس Native أو رابط مباشر"
                }
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              />

              {/* YouTube Validation Pill */}
              {provider === "youtube" && providerVideoId && (() => {
                const ytId = extractYouTubeVideoId(providerVideoId);
                if (ytId) {
                  return (
                    <div className="mt-2 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>تم التحقق من معرّف يوتيوب:</span>
                        <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {ytId}
                        </span>
                      </div>
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

            {/* Duration, Max Watches & Publish Date in 3 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مدة الفيديو (بالدقائق)
                </label>
                <input
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
                />
              </div>
            </div>

            {/* Free Demo Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  تعيين كدرس تجريبي مجاني (Free Preview)
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  يسمح للطلاب غير المشتركين بمشاهدة هذا الدرس لتجربة أسلوب الشرح.
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

        {/* Modal Footer with "Add One" and "Save & Close" */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            زر «أضف واحداً» يحفظ الدرس الحالي ويبقي النافذة مفتوحة لإضافة الدرس التالي مباشرة.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* The Famous "Add One" Button requested by user */}
            <button
              type="button"
              onClick={() => void handleCreateVideo(true)}
              disabled={submitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="إضافة هذا الدرس وإبقاء النموذج جاهزاً لإضافة التالي"
            >
              <Plus className="w-4 h-4" />
              <span>أضف واحداً (Add One)</span>
            </button>

            {/* Save and Close */}
            <button
              type="button"
              onClick={() => void handleCreateVideo(false)}
              disabled={submitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>حفظ وإنهاء</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
