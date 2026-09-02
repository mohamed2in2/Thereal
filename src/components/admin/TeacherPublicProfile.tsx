"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { IconGlobe, IconEye, IconLink, IconBook } from "@/components/admin/AdminIcons";

type Profile = {
  slug: string;
  displayName: string | null;
  bio: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  navColor: string | null;
  accentColor: string | null;
  socials: string | null; // JSON
  featuredCourseId: string | null;
  isPublished: boolean;
  priceMonthly: number | null;
  priceTermly: number | null;
  priceYearly: number | null;
  discountMonthly: number | null;
  discountTermly: number | null;
  discountYearly: number | null;
  stagePricing: string | null;
  priceLanguagesMonthly: number | null;
  priceLanguagesTermly: number | null;
  priceLanguagesYearly: number | null;
  enableLanguagesTrack?: boolean;
  paymentNotes: string | null;
  courseStartDate: string | null;
  bookingContactUrl: string | null;
};

type Socials = { facebook?: string; youtube?: string; tiktok?: string };

// Resize an image file to a max dimension and return a JPEG data URL.
function fileToResizedDataUrl(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img") as HTMLImageElement;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TeacherPublicProfile() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [p, setP] = useState<Profile | null>(null);
  const [socials, setSocials] = useState<Socials>({});
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [slugState, setSlugState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [activeStage, setActiveStage] = useState<"sec_1" | "sec_2">("sec_1");
  const photoInput = useRef<HTMLInputElement>(null);

  const getStagePricing = (stage: "sec_1" | "sec_2") => {
    let parsedMap: Record<string, Record<string, unknown>> = {};
    try {
      if (p?.stagePricing) parsedMap = JSON.parse(p.stagePricing);
    } catch {}

    const stageConfig = (parsedMap[stage] as Record<string, unknown>) || {};
    return {
      bookingEnabled: typeof stageConfig.bookingEnabled === "boolean" ? stageConfig.bookingEnabled : true,
      priceMonthly: typeof stageConfig.priceMonthly === "number" ? stageConfig.priceMonthly : (p?.priceMonthly ?? null),
      priceTermly: typeof stageConfig.priceTermly === "number" ? stageConfig.priceTermly : (p?.priceTermly ?? null),
      priceYearly: typeof stageConfig.priceYearly === "number" ? stageConfig.priceYearly : (p?.priceYearly ?? null),
      priceLanguagesMonthly: typeof stageConfig.priceLanguagesMonthly === "number" ? stageConfig.priceLanguagesMonthly : (p?.priceLanguagesMonthly ?? 0),
      priceLanguagesTermly: typeof stageConfig.priceLanguagesTermly === "number" ? stageConfig.priceLanguagesTermly : (p?.priceLanguagesTermly ?? 0),
      priceLanguagesYearly: typeof stageConfig.priceLanguagesYearly === "number" ? stageConfig.priceLanguagesYearly : (p?.priceLanguagesYearly ?? 0),
      discountMonthly: typeof stageConfig.discountMonthly === "number" ? stageConfig.discountMonthly : null,
      discountTermly: typeof stageConfig.discountTermly === "number" ? stageConfig.discountTermly : null,
      discountYearly: typeof stageConfig.discountYearly === "number" ? stageConfig.discountYearly : null,
    };
  };

  const updateStageField = (field: string, val: unknown) => {
    if (!p) return;
    let parsedMap: Record<string, Record<string, unknown>> = {};
    try {
      if (p.stagePricing) parsedMap = JSON.parse(p.stagePricing);
    } catch {}

    if (!parsedMap.sec_1) parsedMap.sec_1 = getStagePricing("sec_1");
    if (!parsedMap.sec_2) parsedMap.sec_2 = getStagePricing("sec_2");

    parsedMap[activeStage] = {
      ...parsedMap[activeStage],
      [field]: val,
    };

    // Synchronize root price columns with sec_1 or current active stage
    const syncUpdates: Partial<Profile> = {};
    if (activeStage === "sec_1" || p.priceMonthly == null) {
      if (field === "priceMonthly") syncUpdates.priceMonthly = val as number | null;
      if (field === "priceTermly") syncUpdates.priceTermly = val as number | null;
      if (field === "priceYearly") syncUpdates.priceYearly = val as number | null;
      if (field === "priceLanguagesMonthly") syncUpdates.priceLanguagesMonthly = val as number | null;
      if (field === "priceLanguagesTermly") syncUpdates.priceLanguagesTermly = val as number | null;
      if (field === "priceLanguagesYearly") syncUpdates.priceLanguagesYearly = val as number | null;
    }

    setP({
      ...p,
      ...syncUpdates,
      stagePricing: JSON.stringify(parsedMap),
    });
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/profile", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/courses", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([prof, crs]) => {
      if (!active) return;
      if (prof?.profile) {
        setP(prof.profile);
        try { setSocials(prof.profile.socials ? JSON.parse(prof.profile.socials) : {}); } catch { setSocials({}); }
      }
      setCourses((crs?.courses ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  // Debounced slug availability check
  const checkSlug = useCallback((slug: string) => {
    if (!slug || slug.length < 2) { setSlugState("invalid"); return; }
    setSlugState("checking");
    fetch(`/api/admin/profile/slug-check?slug=${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSlugState(d.available ? "ok" : d.reason === "invalid" ? "invalid" : "taken"))
      .catch(() => setSlugState("idle"));
  }, []);

  useEffect(() => {
    if (!p?.slug) return;
    const t = setTimeout(() => checkSlug(p.slug), 450);
    return () => clearTimeout(t);
  }, [p?.slug, checkSlug]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 512);
      set("photoUrl", dataUrl);
      toastSuccess("تم تحميل الصورة بنجاح");
    } catch { toastError("تعذر معالجة الصورة"); }
  };

  const save = async () => {
    if (!p) return;
    if (slugState === "taken" || slugState === "invalid") { toastError("الرابط غير صالح أو مستخدم"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, socials: JSON.stringify(socials) }),
      });
      const data = await res.json();
      if (res.ok) { setP(data.profile); toastSuccess("تم حفظ صفحتك بنجاح"); }
      else toastError(data.error || "تعذر الحفظ");
    } catch { toastError("تعذر الحفظ"); }
    finally { setSaving(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${origin}/${p?.slug}`).then(
      () => toastSuccess("تم نسخ الرابط إلى الحافظة"),
      () => toastError("تعذر النسخ"),
    );
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-28 rounded-3xl skeleton" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 h-96 rounded-3xl skeleton" />
        <div className="lg:col-span-5 h-96 rounded-3xl skeleton" />
      </div>
    </div>
  );

  if (!p) return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
      <p className="text-slate-500 text-sm">تعذر تحميل بيانات الصفحة.</p>
    </div>
  );

  const slugMsg = {
    idle: "", checking: "جارٍ التحقق…", ok: "متاح ✓", taken: "مستخدم بالفعل", invalid: "غير صالح",
  }[slugState];
  const slugColor = slugState === "ok" ? "text-emerald-500" : slugState === "checking" ? "text-slate-400" : "text-rose-500";

  return (
    <div className="space-y-6 w-full" dir="rtl">
      {/* ── TOP EXECUTIVE BANNER (Actions & Status) ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <IconGlobe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>صفحتي العامة (الملف الأكاديمي والاشتراكات)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              صفحتك التعريفية التي تشاركها مع طلابك — تشمل هويتك، نبذتك، وباقات حجز الكورسات.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* Publish Toggle Button */}
            <button
              type="button"
              onClick={() => set("isPublished", !p.isPublished)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                p.isPublished
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              <span>{p.isPublished ? "🟢 الصفحة منشورة للطلاب" : "⚪ الصفحة مسودة (مخفية)"}</span>
            </button>

            {/* Preview Link */}
            <a
              href={`/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <IconEye className="w-3.5 h-3.5 text-slate-400" />
              <span>معاينة</span>
            </a>

            {/* Copy Link */}
            <button
              type="button"
              onClick={copyLink}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <IconLink className="w-3.5 h-3.5 text-slate-400" />
              <span>نسخ الرابط</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── PART 1: HORIZONTAL BALANCED GRID (بالعرض) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Column: Identity & Profile Details (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>👤</span>
                <span>الهوية والبيانات الشخصية</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                تظهر هذه البيانات للطلاب على رأس صفحتك وفي قائمة مدرسي المنصة.
              </p>
            </div>

            {/* Avatar Row */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="صورة المدرس" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{(p.displayName || "؟")[0]}</span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">الصورة الشخصية الرسمية</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">تظهر في قائمة المدرسين وأعلى صفحتك.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {p.photoUrl ? "تغيير الصورة" : "رفع صورة"}
                </button>
                {p.photoUrl && (
                  <button
                    type="button"
                    onClick={() => set("photoUrl", null)}
                    className="px-3 py-2 text-xs text-rose-500 hover:text-rose-400 font-bold transition-colors cursor-pointer"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                الاسم المعروض الأكاديمي
              </label>
              <input
                type="text"
                value={p.displayName ?? ""}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="مثال: أستاذ داوود طارق"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                نبذة تعريفية ومجال التدريس
              </label>
              <textarea
                rows={3}
                value={p.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="خبرة 10 سنوات في تدريس الكيمياء للثانوية العامة واللغات…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all resize-none"
              />
            </div>

            {/* Custom URL Slug */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                رابط صفحتك المخصص (Slug)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0" dir="ltr">
                  {origin}/
                </span>
                <input
                  type="text"
                  dir="ltr"
                  value={p.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="dawood"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
                />
              </div>
              {slugMsg && <p className={`text-[11px] mt-1.5 font-bold ${slugColor}`}>{slugMsg}</p>}
            </div>
          </div>
        </div>

        {/* Left Column: Colors, Preview & Socials (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Theme Colors Card */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>🎨</span>
                <span>ألوان وهوية الصفحة</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                تخصيص ألوان الشريط والأزرار لتناسب علامتك الشخصية.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "navColor", label: "الشريط العلوي", fallback: "#0b0f19" },
                { key: "accentColor", label: "أزرار الاشتراك", fallback: "#10b981" },
              ] as const).map(({ key, label: lbl, fallback }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lbl}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={p[key] ?? fallback}
                      onChange={(e) => set(key, e.target.value)}
                      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent cursor-pointer shrink-0 p-0.5"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={p[key] ?? fallback}
                      onChange={(e) => set(key, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live Interactive Preview */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: p.navColor ?? "#0b0f19" }}>
                <div className="w-5 h-5 rounded-full bg-white/20" />
                <span className="text-white text-xs font-bold">{p.displayName || "أستاذ المادة"}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">معاينة زر الاشتراك:</span>
                <span className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs" style={{ background: p.accentColor ?? "#10b981" }}>
                  اشترك الآن ⚡
                </span>
              </div>
            </div>
          </div>

          {/* Featured Course & Social Media Card */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>🌐</span>
                <span>الكورس المميز وحسابات التواصل</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                <IconBook className="w-3.5 h-3.5 inline -mt-0.5 me-1 text-emerald-500" />
                الكورس المميّز (يظهر أولاً للطلاب)
              </label>
              <select
                value={p.featuredCourseId ?? ""}
                onChange={(e) => set("featuredCourseId", e.target.value || null)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all cursor-pointer"
              >
                <option value="">بدون (عرض الكورسات حسب الترتيب الافتراضي)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5 pt-1">
              {([
                { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
                { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@..." },
                { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
              ] as const).map(({ key, label: lbl, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 w-16 shrink-0">{lbl}:</span>
                  <input
                    type="url"
                    dir="ltr"
                    value={socials[key] ?? ""}
                    onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-white transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── PART 2: SUBSCRIPTION PRICING & BOOKING (انزل لتحت) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>💳</span>
              <span>إعدادات تسعير باقات الاشتراك والحجز</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحكم كامل في أسعار الاشتراك الشهري والترم والسنة، ورسوم مسار اللغات لمرحلتي أولى وثانية بكالوريا.
            </p>
          </div>

          {/* Educational Stage Switcher Pills */}
          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveStage("sec_1")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeStage === "sec_1"
                  ? "bg-white text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-sm border border-slate-200/80 dark:border-emerald-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>🎓</span>
              <span>أولى بكالوريا</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStage("sec_2")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeStage === "sec_2"
                  ? "bg-white text-purple-800 dark:bg-purple-950 dark:text-purple-300 shadow-sm border border-slate-200/80 dark:border-purple-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>🎓</span>
              <span>ثانية بكالوريا</span>
            </button>
          </div>
        </div>

        {(() => {
          const currentP = getStagePricing(activeStage);
          const stageName = activeStage === "sec_1" ? "أولى بكالوريا" : "ثانية بكالوريا";
          
          const monthlyAr = currentP.priceMonthly ?? (p?.priceMonthly ?? 180);
          const termlyAr = currentP.priceTermly ?? (p?.priceTermly ?? 750);
          const yearlyAr = currentP.priceYearly ?? (p?.priceYearly ?? 1200);

          const langMonthly = currentP.priceLanguagesMonthly ?? 0;
          const langTermly = currentP.priceLanguagesTermly ?? 0;
          const langYearly = currentP.priceLanguagesYearly ?? 0;

          const monthlyEn = monthlyAr + langMonthly;
          const termlyEn = termlyAr + langTermly;
          const yearlyEn = yearlyAr + langYearly;

          return (
            <div className="space-y-6">
              {/* Booking Availability & Registration Toggle for Stage */}
              <div className={`p-4 rounded-2xl border transition-all ${currentP.bookingEnabled !== false ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/40'}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{currentP.bookingEnabled !== false ? "🟢" : "🔒"}</span>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        حالة الحجز والتسجيل لـ {stageName}:
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentP.bookingEnabled !== false ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'}`}>
                        {currentP.bookingEnabled !== false ? "متاح ومفتوح للطلاب" : "الحجز مغلق مؤقتاً"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {currentP.bookingEnabled !== false
                        ? `يمكن لطلاب ${stageName} حجز والاشتراك في باقات الكورس الآن.`
                        : `تم إيقاف الحجز لـ ${stageName}. لن يتمكن الطلاب من إرسال طلبات حجز حتى تقوم بإعادة تفعيلها.`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateStageField("bookingEnabled", currentP.bookingEnabled === false ? true : false)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-xs ${
                      currentP.bookingEnabled !== false
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    {currentP.bookingEnabled !== false ? "🚫 إيقاف الحجز لـ " + stageName : "✅ تفعيل الحجز لـ " + stageName}
                  </button>
                </div>
              </div>

              {/* ── 3 PLAN CARDS IN HORIZONTAL GRID (3 Columns) ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1 Month Plan Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>📅</span>
                      <span>اشتراك شهر واحد</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">
                      {monthlyAr} ج.م
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سعر المسار العربي (جنيه) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      value={currentP.priceMonthly ?? ""}
                      onChange={(e) => updateStageField("priceMonthly", e.target.value ? Number(e.target.value) : null)}
                      placeholder="مثال: 180"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      🇬🇧 إضافة مسار اللغات (جنيه):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      value={currentP.priceLanguagesMonthly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesMonthly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 20"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold flex items-center justify-between">
                    <span className="text-slate-500">إجمالي اللغات:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{monthlyEn} ج.م</span>
                  </div>
                </div>

                {/* Term Plan Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>📚</span>
                      <span>اشتراك الترم الكامل</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold">
                      {termlyAr} ج.م
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سعر المسار العربي (جنيه) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      value={currentP.priceTermly ?? ""}
                      onChange={(e) => updateStageField("priceTermly", e.target.value ? Number(e.target.value) : null)}
                      placeholder="مثال: 750"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      🇬🇧 إضافة مسار اللغات (جنيه):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      value={currentP.priceLanguagesTermly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesTermly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 100"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold flex items-center justify-between">
                    <span className="text-slate-500">إجمالي اللغات:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{termlyEn} ج.م</span>
                  </div>
                </div>

                {/* Full Year Plan Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>🎓</span>
                      <span>اشتراك سنة كاملة</span>
                    </span>
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-bold">
                      {yearlyAr} ج.م
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سعر المسار العربي (جنيه) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      value={currentP.priceYearly ?? ""}
                      onChange={(e) => updateStageField("priceYearly", e.target.value ? Number(e.target.value) : null)}
                      placeholder="مثال: 1200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      🇬🇧 إضافة مسار اللغات (جنيه):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      value={currentP.priceLanguagesYearly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesYearly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 200"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold flex items-center justify-between">
                    <span className="text-slate-500">إجمالي اللغات:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{yearlyEn} ج.م</span>
                  </div>
                </div>
              </div>

              {/* ── 2-COLUMN LOGISTICS & INSTRUCTIONS ROW ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Right: Date and WhatsApp Booking URL */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      📅 موعد بدء أول كورس ومحاضرة
                    </label>
                    <input
                      type="date"
                      value={p.courseStartDate ? p.courseStartDate.slice(0, 10) : ""}
                      onChange={(e) => set("courseStartDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      🔗 رابط التواصل / الحجز المباشر (واتساب أو بوابة الدفع)
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={p.bookingContactUrl ?? ""}
                      onChange={(e) => set("bookingContactUrl", e.target.value || null)}
                      placeholder="https://wa.me/201234567890"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">يُنقل الطالب إليه بنقرة واحدة عند الضغط على زر الحجز.</p>
                  </div>
                </div>

                {/* Left: Custom Payment Instructions */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    📝 تعليمات وطرق الدفع المعروضة للطلاب
                  </label>
                  <textarea
                    rows={4}
                    value={p.paymentNotes ?? ""}
                    onChange={(e) => set("paymentNotes", e.target.value || null)}
                    placeholder="مثال: التحويل متاح عبر فودافون كاش على رقم 01xxxxxxxx أو إنستاباي، ثم إرسال سكرين شوت لتفعيل الحساب فوراً."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white outline-none focus:border-emerald-500 resize-none font-medium leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400">تظهر هذه التعليمات للطلاب في صفحة إتمام الحجز.</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── FULL-WIDTH ACTION FOOTER (حفظ إعدادات الصفحة) ── */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>💾</span>
          <span>{saving ? "جارٍ حفظ التغييرات…" : "حفظ إعدادات صفحة المدرس والأسعار"}</span>
        </button>
      </div>
    </div>
  );
}
