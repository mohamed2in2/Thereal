"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface PrizeItem {
  rank: number;
  rankLabel: string;
  title: string;
  prize: string;
  icon?: string;
  highlight?: boolean;
}

interface ApiResponse {
  prizes: PrizeItem[];
  defaults: PrizeItem[];
  lastCalculatedAt: string | null;
  prizesUpdatedAt: string | null;
  studentCount: number;
  topStudentsCount: number;
}

const AVAILABLE_ICONS = ["🥇", "🥈", "🥉", "🏆", "🎁", "⭐", "🎖️", "🏷️", "💫", "🌟", "👑", "💎", "🎒", "🎧", "💻", "🔥"];

export function LeaderboardPrizesSection() {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [meta, setMeta] = useState<Omit<ApiResponse, "prizes" | "defaults"> | null>(null);

  const fetchPrizes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/superadmin/leaderboard-prizes", { credentials: "include" });
      const data: ApiResponse = await res.json();
      if (res.ok) {
        setPrizes(data.prizes || []);
        setMeta({
          lastCalculatedAt: data.lastCalculatedAt,
          prizesUpdatedAt: data.prizesUpdatedAt,
          studentCount: data.studentCount,
          topStudentsCount: data.topStudentsCount,
        });
      } else {
        toastError("تعذر تحميل إعدادات الجوائز");
      }
    } catch {
      toastError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void fetchPrizes();
  }, [fetchPrizes]);

  const updatePrize = (index: number, field: keyof PrizeItem, val: any) => {
    setPrizes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSavePrizes = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/superadmin/leaderboard-prizes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_prizes",
          prizes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || "تم حفظ جوائز المراكز العشرة وتحديث الكاش بنجاح ✅");
        void fetchPrizes();
      } else {
        toastError(data.error || "تعذر حفظ الجوائز");
      }
    } catch {
      toastError("فشل حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  const handleForceRecalculate = async () => {
    if (!confirm("هل تريد بالتأكيد إعادة احتساب وتحديث لوحة الشرف وجميع نقاط وسلاسل الطلاب فوراً بقوة؟")) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/admin/superadmin/leaderboard-prizes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_recalculate" }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || "تمت إعادة احتساب لوحة الشرف وتحديث الكاش بنجاح ✅");
        void fetchPrizes();
      } else {
        toastError(data.error || "فشل إعادة احتساب لوحة الشرف");
      }
    } catch {
      toastError("فشل الاتصال بالسيرفر");
    } finally {
      setRecalculating(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("هل تريد استعادة الجوائز الافتراضية للمراكز العشرة؟")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/superadmin/leaderboard-prizes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_defaults" }),
      });
      const data = await res.json();
      if (res.ok) {
        success(data.message || "تمت استعادة الجوائز الافتراضية بنجاح ✅");
        setPrizes(data.prizes);
        void fetchPrizes();
      } else {
        toastError(data.error || "تعذر استعادة الجوائز");
      }
    } catch {
      toastError("فشل تنفيذ الإجراء");
    } finally {
      setSaving(false);
    }
  };

  const rankBadgeBg = (rank: number) => {
    if (rank === 1) return "linear-gradient(135deg, #F59E0B, #D97706)";
    if (rank === 2) return "linear-gradient(135deg, #94A3B8, #64748B)";
    if (rank === 3) return "linear-gradient(135deg, #D97706, #B45309)";
    return "var(--surface-2)";
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[var(--ink-muted)]">
        <span className="inline-block w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin me-2 align-middle" />
        جارٍ تحميل نظام جوائز لوحة الشرف والكاش...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── HEADER BANNER ── */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--ink)] flex items-center gap-2">
              <span>🏆</span> جوائز لوحة الشرف اليومية (24 ساعة — المراكز العشرة)
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1 leading-relaxed">
              تحديد الجوائز والمكافآت الخاصة بالمراكز من 1 إلى 10 في لوحة الشرف اليومية. 
              يتم حفظ البيانات في كاش فائق السرعة بدون أي استهلاك للمعالج عند دخول الطلاب، ويُعاد تدويرها تلقائياً الساعة <strong>3:00 فجراً بتوقيت القاهرة</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleForceRecalculate}
              disabled={recalculating || saving}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{recalculating ? "⏳ جارٍ التحديث بقوة..." : "⚡ تحديث واحتساب الكاش فوراً بقوة"}</span>
            </button>

            <button
              type="button"
              onClick={handleSavePrizes}
              disabled={saving || recalculating}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span>{saving ? "جارٍ الحفظ..." : "💾 حفظ جوائز المراكز الـ 10"}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border)] text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[var(--ink-muted)]">آخر احتساب للكاش:</span>
            <strong className="text-[var(--ink)]">
              {meta?.lastCalculatedAt
                ? new Date(meta.lastCalculatedAt).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "medium" })
                : "غير متوفر"}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold">⏰</span>
            <span className="text-[var(--ink-muted)]">الموعد التلقائي اليومي:</span>
            <strong className="text-amber-500">3:00 ص بتوقيت القاهرة (يومياً)</strong>
          </div>

          <div className="flex items-center gap-2 justify-start sm:justify-end">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving || recalculating}
              className="text-[11px] text-[var(--ink-muted)] hover:text-red-500 hover:underline transition-colors"
            >
              ↺ استعادة الجوائز الافتراضية
            </button>
          </div>
        </div>
      </div>

      {/* ── PRIZES EDIT GRID (10 RANKS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {prizes.map((p, idx) => {
          const isTop3 = p.rank <= 3;
          return (
            <div
              key={p.rank}
              className={`bg-[var(--surface)] border rounded-2xl p-5 space-y-3 transition-all ${
                isTop3 ? "border-amber-500/40 shadow-xs" : "border-[var(--border)]"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-xs"
                    style={{ background: rankBadgeBg(p.rank) }}
                  >
                    {p.rank}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-1.5">
                      <span>{p.rankLabel || `المركز ${p.rank}`}</span>
                      {isTop3 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-black">منصة التتويج</span>}
                    </h3>
                  </div>
                </div>

                {/* Icon Selector */}
                <div className="flex items-center gap-1 bg-[var(--bg)] px-2 py-1 rounded-xl border border-[var(--border)]">
                  <span className="text-xs text-[var(--ink-muted)] ml-1">الأيقونة:</span>
                  <select
                    value={p.icon || "🎁"}
                    onChange={(e) => updatePrize(idx, "icon", e.target.value)}
                    className="bg-transparent border-none text-base cursor-pointer focus:outline-none"
                  >
                    {AVAILABLE_ICONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title & Rank Label Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink-muted)] mb-1">
                    المسمى التكريمي للمركز
                  </label>
                  <input
                    type="text"
                    value={p.title}
                    onChange={(e) => updatePrize(idx, "title", e.target.value)}
                    placeholder={`مثال: ${p.rankLabel}`}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-sky-500 transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink-muted)] mb-1">
                    تمييز الجائزة
                  </label>
                  <label className="flex items-center gap-2 h-[34px] bg-[var(--bg)] px-3 rounded-xl border border-[var(--border)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!p.highlight}
                      onChange={(e) => updatePrize(idx, "highlight", e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                    />
                    <span className="text-xs text-[var(--ink)] font-medium">إبراز بلون ذهبي فاقع</span>
                  </label>
                </div>
              </div>

              {/* Prize Description */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-muted)] mb-1">
                  تفاصيل ووصف الجائزة *
                </label>
                <textarea
                  rows={2}
                  value={p.prize}
                  onChange={(e) => updatePrize(idx, "prize", e.target.value)}
                  placeholder="اكتب الجائزة (مثل: تيشيرت + كود اشتراك + 500 نقطة)..."
                  className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-sky-500 transition-all resize-none font-medium"
                />
              </div>

              {/* Live Preview Snippet */}
              <div className="pt-1">
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                    p.highlight
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      : "bg-[var(--bg)] border-[var(--border)] text-[var(--ink)]"
                  }`}
                >
                  <span className="text-base">{p.icon || "🎁"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-[var(--ink)]">{p.title || p.rankLabel}: </span>
                    <span className="text-[var(--ink-2)] text-[11px]">{p.prize || "لم يتم تحديد جائزة"}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button Floating Bottom Footer */}
      <div className="sticky bottom-4 z-20 bg-[var(--surface)]/90 backdrop-blur-md p-4 rounded-2xl border border-[var(--border)] shadow-xl flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--ink-muted)]">
          💾 اضغط "حفظ التعديلات" لتطبيق التغييرات على لوحة الشرف فوراً.
        </p>
        <button
          type="button"
          onClick={handleSavePrizes}
          disabled={saving || recalculating}
          className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{saving ? "جارٍ الحفظ..." : "💾 حفظ وتطبيق جوائز المراكز العشرة"}</span>
        </button>
      </div>
    </div>
  );
}
