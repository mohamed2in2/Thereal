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

const input =
  "w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm placeholder:text-[var(--ink-muted)] focus:outline-none focus:border-sky-400/60 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all";
const label = "block text-xs font-semibold text-[var(--ink-muted)] mb-1.5";
const card = "bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink-muted)]/40 text-sm font-semibold transition-colors";

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
  const [origin, setOrigin] = useState("");
  const [slugState, setSlugState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [activeStage, setActiveStage] = useState<"sec_1" | "sec_2">("sec_1");
  const photoInput = useRef<HTMLInputElement>(null);

  const getStagePricing = (stage: "sec_1" | "sec_2") => {
    let parsedMap: Record<string, any> = {};
    try {
      if (p?.stagePricing) parsedMap = JSON.parse(p.stagePricing);
    } catch {}

    const stageConfig = parsedMap[stage] || {};
    return {
      bookingEnabled: typeof stageConfig.bookingEnabled === "boolean" ? stageConfig.bookingEnabled : true,
      priceMonthly: typeof stageConfig.priceMonthly === "number" ? stageConfig.priceMonthly : 180,
      priceTermly: typeof stageConfig.priceTermly === "number" ? stageConfig.priceTermly : 750,
      priceYearly: typeof stageConfig.priceYearly === "number" ? stageConfig.priceYearly : 1200,
      priceLanguagesMonthly: typeof stageConfig.priceLanguagesMonthly === "number" ? stageConfig.priceLanguagesMonthly : (p?.priceLanguagesMonthly ?? 0),
      priceLanguagesTermly: typeof stageConfig.priceLanguagesTermly === "number" ? stageConfig.priceLanguagesTermly : (p?.priceLanguagesTermly ?? 0),
      priceLanguagesYearly: typeof stageConfig.priceLanguagesYearly === "number" ? stageConfig.priceLanguagesYearly : (p?.priceLanguagesYearly ?? 0),
      discountMonthly: typeof stageConfig.discountMonthly === "number" ? stageConfig.discountMonthly : null,
      discountTermly: typeof stageConfig.discountTermly === "number" ? stageConfig.discountTermly : null,
      discountYearly: typeof stageConfig.discountYearly === "number" ? stageConfig.discountYearly : null,
    };
  };

  const updateStageField = (field: string, val: any) => {
    if (!p) return;
    let parsedMap: Record<string, any> = {};
    try {
      if (p.stagePricing) parsedMap = JSON.parse(p.stagePricing);
    } catch {}

    if (!parsedMap.sec_1) parsedMap.sec_1 = getStagePricing("sec_1");
    if (!parsedMap.sec_2) parsedMap.sec_2 = getStagePricing("sec_2");

    parsedMap[activeStage] = {
      ...parsedMap[activeStage],
      [field]: val,
    };

    setP({
      ...p,
      stagePricing: JSON.stringify(parsedMap),
    });
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      fetch("/api/admin/profile", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/courses", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([prof, crs]) => {
      if (prof?.profile) {
        setP(prof.profile);
        try { setSocials(prof.profile.socials ? JSON.parse(prof.profile.socials) : {}); } catch { setSocials({}); }
      }
      setCourses((crs?.courses ?? []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    }).finally(() => setLoading(false));
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
      if (res.ok) { setP(data.profile); toastSuccess("تم حفظ صفحتك"); }
      else toastError(data.error || "تعذر الحفظ");
    } catch { toastError("تعذر الحفظ"); }
    finally { setSaving(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${origin}/${p?.slug}`).then(
      () => toastSuccess("تم نسخ الرابط"),
      () => toastError("تعذر النسخ"),
    );
  };

  if (loading) return <div className="space-y-4"><div className="h-40 rounded-2xl skeleton" /><div className="h-64 rounded-2xl skeleton" /></div>;
  if (!p) return <div className={card}><p className="text-[var(--ink-muted)] text-sm">تعذر تحميل بيانات الصفحة.</p></div>;

  const slugMsg = {
    idle: "", checking: "جارٍ التحقق…", ok: "متاح ✓", taken: "مستخدم بالفعل", invalid: "غير صالح",
  }[slugState];
  const slugColor = slugState === "ok" ? "text-emerald-500" : slugState === "checking" ? "text-[var(--ink-muted)]" : "text-rose-500";

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header / publish + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[var(--ink)] flex items-center gap-2"><IconGlobe className="w-5 h-5 text-sky-500" /> صفحتي العامة</h2>
          <p className="text-sm text-[var(--ink-muted)] mt-0.5">صفحتك الشخصية التي تشاركها مع طلابك — صورتك، نبذتك، وكل كورساتك.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className={ghostBtn}><IconEye className="w-4 h-4" /> معاينة</a>
          <button onClick={copyLink} className={ghostBtn}><IconLink className="w-4 h-4" /> نسخ الرابط</button>
        </div>
      </div>

      {/* Publish toggle */}
      <div className={`${card} flex items-center justify-between gap-3`}>
        <div>
          <p className="font-bold text-[var(--ink)]">{p.isPublished ? "الصفحة منشورة" : "الصفحة مسودة (غير منشورة)"}</p>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">{p.isPublished ? "أي شخص يملك الرابط يمكنه رؤيتها." : "لن تظهر للطلاب حتى تنشرها."}</p>
        </div>
        <button
          onClick={() => set("isPublished", !p.isPublished)}
          role="switch"
          aria-checked={p.isPublished}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${p.isPublished ? "bg-emerald-500" : "bg-[var(--border)]"}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${p.isPublished ? "left-1" : "left-6"}`} />
        </button>
      </div>

      {/* Identity & Photo Section */}
      <div className={`${card} space-y-5`}>
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-[var(--bg)] border-2 border-sky-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="صورة المدرس" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-sky-500">{(p.displayName || "؟")[0]}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-[var(--ink)] text-base">الصورة الشخصية للمدرس 📸</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                تظهر للطلاب في صفحة الكورسات وقائمة المدرسين.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            <button onClick={() => photoInput.current?.click()} className={primaryBtn}>
              {p.photoUrl ? "تغيير الصورة" : "إضافة صورة شخصية"}
            </button>
            {p.photoUrl && (
              <button onClick={() => set("photoUrl", null)} className="px-3 py-2 text-xs text-rose-500 hover:text-rose-400 font-bold transition-colors">
                حذف الصورة
              </button>
            )}
          </div>
        </div>

        <div>
          <label className={label}>الاسم المعروض</label>
          <input className={input} value={p.displayName ?? ""} onChange={(e) => set("displayName", e.target.value)} placeholder="مثال: مستر خالد" />
        </div>
        <div>
          <label className={label}>نبذة تعريفية</label>
          <textarea rows={3} className={`${input} resize-none`} value={p.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="خبرة 10 سنوات في تدريس الرياضيات للثانوية العامة…" />
        </div>

        {/* Slug */}
        <div>
          <label className={label}>رابط الصفحة</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-muted)] shrink-0 font-mono" dir="ltr">{origin}/</span>
            <input className={`${input} font-mono`} dir="ltr" value={p.slug} onChange={(e) => set("slug", e.target.value)} placeholder="MR-KHALED" />
          </div>
          {slugMsg && <p className={`text-[11px] mt-1.5 font-semibold ${slugColor}`}>{slugMsg}</p>}
        </div>
      </div>

      {/* Theme colors */}
      <div className={`${card} space-y-4`}>
        <h3 className="font-bold text-[var(--ink)]">ألوان الصفحة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: "navColor", label: "لون الشريط العلوي", fallback: "#0b0f19" },
            { key: "accentColor", label: "لون الأزرار والتمييز", fallback: "#6366f1" },
          ] as const).map(({ key, label: lbl, fallback }) => (
            <div key={key}>
              <label className={label}>{lbl}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={p[key] ?? fallback} onChange={(e) => set(key, e.target.value)} className="w-10 h-10 rounded-lg border border-[var(--border)] bg-transparent cursor-pointer shrink-0" />
                <input className={`${input} font-mono`} dir="ltr" value={p[key] ?? fallback} onChange={(e) => set(key, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        {/* Live preview */}
        <div className="rounded-xl overflow-hidden border border-[var(--border)]">
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: p.navColor ?? "#0b0f19" }}>
            <div className="w-6 h-6 rounded-full bg-white/20" />
            <span className="text-white text-sm font-bold">{p.displayName || "اسمك هنا"}</span>
          </div>
          <div className="p-4 bg-[var(--bg)] flex items-center justify-between">
            <span className="text-xs text-[var(--ink-muted)]">معاينة الزر</span>
            <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: p.accentColor ?? "#6366f1" }}>اشترك الآن</span>
          </div>
        </div>
      </div>

      {/* Featured course + socials */}
      <div className={`${card} space-y-4`}>
        <div>
          <label className={label}><IconBook className="w-3.5 h-3.5 inline -mt-0.5 me-1" />الكورس المميّز (يظهر أولاً)</label>
          <select className={input} value={p.featuredCourseId ?? ""} onChange={(e) => set("featuredCourseId", e.target.value || null)}>
            <option value="">بدون</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { key: "facebook", label: "Facebook" },
            { key: "youtube", label: "YouTube" },
            { key: "tiktok", label: "TikTok" },
          ] as const).map(({ key, label: lbl }) => (
            <div key={key}>
              <label className={label}>{lbl}</label>
              <input className={`${input} font-mono`} dir="ltr" value={socials[key] ?? ""} onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))} placeholder="https://…" />
            </div>
          ))}
        </div>
      </div>

      {/* Subscription Pricing & Booking Section */}
      <div className={`${card} space-y-5`}>
        <div>
          <h3 className="font-bold text-[var(--ink)] flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            إعدادات تسعير الاشتراكات والحجز 💳
          </h3>
          <p className="text-xs text-[var(--ink-muted)] mt-1">تحكم كامل في أسعار الاشتراك، نسبة الخصم، ورسوم مسار اللغات لمرحلتي أولى بكالوريا وثانية بكالوريا.</p>
        </div>

        {/* Stage Pricing Selector Header */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] space-y-3">
          <label className="block text-xs font-bold text-[var(--ink)]">تخصيص أسعار الاشتراك حسب المرحلة الدراسية:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveStage("sec_1")}
              className={`p-3 rounded-lg border text-right space-y-1 transition-all cursor-pointer ${
                activeStage === "sec_1"
                  ? "border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/40 shadow-md"
                  : "border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 opacity-70"
              }`}
            >
              <span className="text-xs font-extrabold text-sky-500 flex items-center gap-1">
                <span>🎓</span> أولى بكالوريا
              </span>
              <p className="text-[11px] text-[var(--ink-muted)]">
                {activeStage === "sec_1" ? "تعديل أسعار الصف الأول بكالوريا (مفعل)" : "اضغط لتعديل أسعار الأول بكالوريا"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveStage("sec_2")}
              className={`p-3 rounded-lg border text-right space-y-1 transition-all cursor-pointer ${
                activeStage === "sec_2"
                  ? "border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/40 shadow-md"
                  : "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 opacity-70"
              }`}
            >
              <span className="text-xs font-extrabold text-purple-400 flex items-center gap-1">
                <span>🎓</span> ثانية بكالوريا
              </span>
              <p className="text-[11px] text-[var(--ink-muted)]">
                {activeStage === "sec_2" ? "تعديل أسعار الصف الثاني بكالوريا (مفعل)" : "اضغط لتعديل أسعار الثاني بكالوريا"}
              </p>
            </button>
          </div>
        </div>

        {(() => {
          const currentP = getStagePricing(activeStage);
          const stageName = activeStage === "sec_1" ? "أولى بكالوريا" : "ثانية بكالوريا";
          
          const monthlyAr = currentP.priceMonthly ?? 180;
          const termlyAr = currentP.priceTermly ?? 750;
          const yearlyAr = currentP.priceYearly ?? 1200;

          const langMonthly = currentP.priceLanguagesMonthly ?? 0;
          const langTermly = currentP.priceLanguagesTermly ?? 0;
          const langYearly = currentP.priceLanguagesYearly ?? 0;

          const monthlyEn = monthlyAr + langMonthly;
          const termlyEn = termlyAr + langTermly;
          const yearlyEn = yearlyAr + langYearly;

          return (
            <div className="space-y-4">
              <div className="px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-between">
                <span>📍 إعدادات وباقات: {stageName}</span>
                <span className="text-[10px] text-[var(--ink-muted)]">التعديلات أدناه تنطبق على طلاب {stageName} فقط</span>
              </div>

              {/* Booking Availability & Registration Toggle for Stage */}
              <div className={`p-4 rounded-xl border transition-all ${currentP.bookingEnabled !== false ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/40'}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{currentP.bookingEnabled !== false ? "🟢" : "🔒"}</span>
                      <h4 className="font-bold text-sm text-[var(--ink)]">
                        حالة الحجز والتسجيل لـ {stageName}
                      </h4>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${currentP.bookingEnabled !== false ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                        {currentP.bookingEnabled !== false ? "متاح ومفتوح للطلاب" : "الحجز مغلق مؤقتاً"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)] mt-1">
                      {currentP.bookingEnabled !== false
                        ? `يمكن لطلاب ${stageName} حجز والاشتراك في باقات الكورس الآن.`
                        : `تم إيقاف الحجز لـ ${stageName}. لن يتمكن الطلاب من إرسال طلبات حجز أو الاشتراك في هذه المرحلة حتى تقوم بإعادة تفعيلها.`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateStageField("bookingEnabled", currentP.bookingEnabled === false ? true : false)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm ${
                      currentP.bookingEnabled !== false
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    {currentP.bookingEnabled !== false ? "🚫 إيقاف الحجز لـ " + stageName : "✅ فتح وتفعيل الحجز لـ " + stageName}
                  </button>
                </div>
              </div>

              {/* Languages Track (GB 🇬🇧) Custom Pricing Config */}
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                    <span>🇬🇧</span> رسوم مسار اللغات / إنجليزي (GB) لكل اشتراك (مخصص وغير آلي)
                  </h4>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 font-bold">
                    تحديد مخصص لكل باقة
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  يمكنك تحديد مبلغ إضافي مخصص لمسار اللغات لكل اشتراك (شهري / ترم / سنة) دون الحساب الآلي التلقائي.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={label}>📅 زيادة GB شهرياً (جنيه):</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={input}
                      value={currentP.priceLanguagesMonthly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesMonthly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 20"
                    />
                  </div>
                  <div>
                    <label className={label}>📚 زيادة GB للترم (جنيه):</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={input}
                      value={currentP.priceLanguagesTermly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesTermly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 100"
                    />
                  </div>
                  <div>
                    <label className={label}>🎓 زيادة GB للسنة (جنيه):</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={input}
                      value={currentP.priceLanguagesYearly ?? ""}
                      onChange={(e) => updateStageField("priceLanguagesYearly", e.target.value ? Number(e.target.value) : 0)}
                      placeholder="مثال: 200"
                    />
                  </div>
                </div>
              </div>

              {/* 1 Month Plan */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                <h4 className="font-bold text-sm text-[var(--ink)] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span>📅</span> اشتراك شهر واحد</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
                      عربي: {monthlyAr}ج
                    </span>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      لغات (GB): {monthlyEn}ج {langMonthly > 0 ? `(+${langMonthly}ج)` : ""}
                    </span>
                  </div>
                </h4>
                <div>
                  <label className={label}>السعر المباشر للمسار العربي (جنيه - افتراضي 180ج)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={input}
                    value={currentP.priceMonthly ?? ""}
                    onChange={(e) => updateStageField("priceMonthly", e.target.value ? Number(e.target.value) : null)}
                    placeholder="180"
                  />
                </div>
              </div>

              {/* 3 Months Plan (Term) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                <h4 className="font-bold text-sm text-[var(--ink)] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span>📚</span> اشتراك الترم</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      عربي: {termlyAr}ج
                    </span>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      لغات (GB): {termlyEn}ج {langTermly > 0 ? `(+${langTermly}ج)` : ""}
                    </span>
                  </div>
                </h4>
                <div>
                  <label className={label}>السعر المباشر للمسار العربي (جنيه - افتراضي 750ج)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={input}
                    value={currentP.priceTermly ?? ""}
                    onChange={(e) => updateStageField("priceTermly", e.target.value ? Number(e.target.value) : null)}
                    placeholder="750"
                  />
                </div>
              </div>

              {/* 6 Months Plan (Year) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                <h4 className="font-bold text-sm text-[var(--ink)] mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span>🎓</span> اشتراك سنة كاملة</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                      عربي: {yearlyAr}ج
                    </span>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      لغات (GB): {yearlyEn}ج {langYearly > 0 ? `(+${langYearly}ج)` : ""}
                    </span>
                  </div>
                </h4>
                <div>
                  <label className={label}>السعر المباشر للمسار العربي (جنيه - افتراضي 1200ج)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={input}
                    value={currentP.priceYearly ?? ""}
                    onChange={(e) => updateStageField("priceYearly", e.target.value ? Number(e.target.value) : null)}
                    placeholder="1200"
                  />
                </div>
              </div>

              {/* Comparison Summary Card */}
              <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 space-y-3">
                <h4 className="font-black text-xs text-sky-400 flex items-center gap-2">
                  <span>📊</span> ملخص أسعار الحجز المباشر لطلاب ({stageName}):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                    <span className="font-bold text-sky-500 block">🇪🇬 المسار العربي:</span>
                    <p className="text-[11px] text-[var(--ink-muted)]">📅 شهري: <strong className="text-[var(--ink)]">{monthlyAr} جنيه</strong></p>
                    <p className="text-[11px] text-[var(--ink-muted)]">📚 ترم كامل: <strong className="text-[var(--ink)]">{termlyAr} جنيه</strong></p>
                    <p className="text-[11px] text-[var(--ink-muted)]">🎓 سنة كاملة: <strong className="text-[var(--ink)]">{yearlyAr} جنيه</strong></p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                    <span className="font-bold text-indigo-400 block">🇬🇧 مسار اللغات / إنجليزي (GB):</span>
                    <p className="text-[11px] text-[var(--ink-muted)]">📅 شهري: <strong className="text-[var(--ink)]">{monthlyEn} جنيه</strong> {langMonthly > 0 ? `(+${langMonthly}ج مخصص)` : ""}</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">📚 ترم كامل: <strong className="text-[var(--ink)]">{termlyEn} جنيه</strong> {langTermly > 0 ? `(+${langTermly}ج مخصص)` : ""}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className={label}>📅 تاريخ بدء أول كورس</label>
            <input
              type="date"
              className={input}
              value={p.courseStartDate ? p.courseStartDate.slice(0, 10) : ""}
              onChange={(e) => set("courseStartDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
          <div>
            <label className={label}>🔗 رابط التواصل / الحجز المباشر</label>
            <input
              className={`${input} font-mono`}
              dir="ltr"
              value={p.bookingContactUrl ?? ""}
              onChange={(e) => set("bookingContactUrl", e.target.value || null)}
              placeholder="https://wa.me/201234567890"
            />
            <p className="text-[10px] text-[var(--ink-muted)] mt-1">رابط واتساب أو صفحة الدفع المباشر الخاصة بك.</p>
          </div>
        </div>

        <div>
          <label className={label}>📝 تعليمات الدفع المخصصة للطلاب (اختياري)</label>
          <textarea
            rows={2}
            className={`${input} resize-none`}
            value={p.paymentNotes ?? ""}
            onChange={(e) => set("paymentNotes", e.target.value || null)}
            placeholder="مثال: حول على فودافون كاش 01xxxxxxxx ورسل صورة التحويل على واتساب لتفعيل اشتراكك فوراً!"
          />
        </div>
      </div>

      <button onClick={save} disabled={saving} className={`${primaryBtn} w-full py-3 text-base`}>
        {saving ? "جارٍ حفظ التغييرات…" : "حفظ إعدادات صفحة المدرس والأسعار 💾"}
      </button>
    </div>
  );
}
