"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Navbar daily-streak flame. Shows a 🔥 + count whose color "heats up" with the
 * streak. Clicking opens a share sheet so students can flex their streak to
 * friends (native share on mobile + WhatsApp/Telegram/Facebook/X/copy fallback).
 */
function tier(streak: number) {
  if (streak <= 0) return { color: "#94a3b8", glow: "transparent", label: "ابدأ سلسلتك" };
  if (streak < 3) return { color: "#f59e0b", glow: "rgba(245,158,11,0.55)", label: "بداية جيدة" };
  if (streak < 7) return { color: "#f97316", glow: "rgba(249,115,22,0.55)", label: "مستمر" };
  if (streak < 14) return { color: "#ef4444", glow: "rgba(239,68,68,0.6)", label: "أسبوع كامل 🔥" };
  if (streak < 30) return { color: "#f43f5e", glow: "rgba(244,63,94,0.6)", label: "مواظبة قوية" };
  return { color: "#38bdf8", glow: "rgba(56,189,248,0.75)", label: "لهب أزرق! 💎" };
}

const FlameIcon = ({ color, size = 18, glow }: { color: string; size?: number; glow?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}>
    <path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-1 .5-2 1-3 0 0-3 2-3 6a6 6 0 0012 0c0-5-6-11-6-11z" />
  </svg>
);

export function StreakFlame({ role }: { role?: string }) {
  const [streak, setStreak] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (role !== "student") return;
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");

    // /api/student/stats has Cache-Control: private, max-age=300 so the browser
    // deduplicates this with any other caller on the same page (library, notif panel).
    let alive = true;
    fetch("/api/student/stats", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { streak?: number } | null) => { if (alive && d) setStreak(d.streak ?? 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [role]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (role !== "student" || streak === null) return null;

  const t = tier(streak);
  const active = streak > 0;
  const url = typeof window !== "undefined" ? window.location.origin : "https://code-up.tech";
  const message = active
    ? `🔥 سلسلة مواظبتي على Code-UP وصلت ${streak} ${streak === 1 ? "يوم" : "أيام"} متتالية! ذاكر معايا وابدأ سلسلتك 💪`
    : `بدأت رحلتي التعليمية على Code-UP 💪 انضم إليّ!`;
  const shareText = `${message}\n${url}`;

  const openWin = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const nativeShare = async () => {
    try { await navigator.share({ title: "Code-UP", text: message, url }); setOpen(false); } catch { /* cancelled */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const targets = [
    { id: "whatsapp", label: "واتساب", color: "#25D366", href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      icon: <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z M12.05 2C6.5 2 2 6.5 2 12.05c0 1.97.58 3.8 1.57 5.34L2 22l4.7-1.54a10 10 0 005.35 1.54C17.6 22 22.1 17.5 22.1 11.95 22.1 6.5 17.6 2 12.05 2z" /> },
    { id: "telegram", label: "تيليجرام", color: "#229ED9", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
      icon: <path d="M21.94 4.3l-3.1 14.6c-.23 1.03-.84 1.28-1.7.8l-4.7-3.47-2.27 2.18c-.25.25-.46.46-.94.46l.34-4.78L18.2 6.1c.38-.34-.08-.53-.6-.2L7.34 12.6l-4.66-1.46c-1.01-.32-1.03-1.01.21-1.5L20.6 2.83c.84-.31 1.58.2 1.34 1.47z" /> },
    { id: "facebook", label: "فيسبوك", color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`,
      icon: <path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z" /> },
    { id: "x", label: "X", color: "#0f172a", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
      icon: <path d="M18.9 2H22l-7.5 8.57L23 22h-6.8l-5.3-6.9L4.8 22H2l8-9.16L1.3 2h6.97l4.8 6.34L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z" /> },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`سلسلة المواظبة: ${streak} يوم — اضغط للمشاركة`}
        aria-label={`سلسلة المواظبة ${streak} يوم — مشاركة`}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--border)] transition-colors"
      >
        <span className={active ? "streak-flame" : ""} style={{ display: "inline-flex", transformOrigin: "50% 70%" }}>
          <FlameIcon color={t.color} glow={active ? t.glow : undefined} />
        </span>
        <span className="text-sm font-black tabular-nums" style={{ color: t.color }}>{streak}</span>
        <style jsx>{`
          .streak-flame { animation: flamePulse 1.8s ease-in-out infinite; }
          @keyframes flamePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
          @media (prefers-reduced-motion: reduce) { .streak-flame { animation: none; } }
        `}</style>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label="مشاركة السلسلة" dir="rtl"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-[var(--z-modal)] w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl text-center"
            >
              <button onClick={() => setOpen(false)} aria-label="إغلاق" className="absolute top-3 left-3 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--border)] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>

              {/* Streak hero */}
              <div className="mx-auto mb-3 w-20 h-20 rounded-2xl flex flex-col items-center justify-center" style={{ background: active ? `${t.color}1f` : "var(--border)" }}>
                <FlameIcon color={t.color} size={34} glow={active ? t.glow : undefined} />
              </div>
              <p className="text-2xl font-black" style={{ color: t.color }}>{streak} {streak === 1 ? "يوم" : "أيام"}</p>
              <p className="text-sm text-[var(--ink-muted)] mt-1 mb-5 leading-relaxed">{active ? `سلسلة مواظبة متتالية — ${t.label}` : "ابدأ سلسلتك اليوم وشاركها!"}</p>

              {canNativeShare && (
                <button onClick={nativeShare} className="w-full mb-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v14" /></svg>
                  مشاركة
                </button>
              )}

              <div className="grid grid-cols-4 gap-2 mb-3">
                {targets.map((s) => (
                  <button key={s.id} onClick={() => openWin(s.href)} title={s.label}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--border)] transition-colors">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={s.color} aria-hidden>{s.icon}</svg>
                    <span className="text-[10px] font-semibold text-[var(--ink-muted)]">{s.label}</span>
                  </button>
                ))}
              </div>

              <button onClick={copy} className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink-muted)]/40 transition-colors flex items-center justify-center gap-2">
                {copied ? (
                  <><svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6L9 17l-5-5" /></svg> تم النسخ</>
                ) : (
                  <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg> نسخ النص والرابط</>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
