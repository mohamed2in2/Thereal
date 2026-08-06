"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getResolvedTheme, setThemePreference, type Theme } from "@/lib/theme";

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

const TABS = [
  { id: "teacher",     label: "مدرّس" },
  { id: "staff_portal", label: "مشرف / موظف" },
  { id: "superadmin",  label: "المشرف العام" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("themechange", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("themechange", cb);
  };
}
const getSnapshot       = (): Theme => getResolvedTheme();
const getServerSnapshot = (): Theme => "light";

export default function AdminPanelLoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("teacher");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const theme  = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";
  const cycleTheme = () => setThemePreference(isDark ? "light" : "dark");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    const body =
      activeTab === "superadmin"
        ? { role: "superadmin", password: form.password }
      : activeTab === "teacher"
        ? { role: "teacher", name: form.name, password: form.password }
        : { role: "staff_portal", email: form.email, password: form.password };

    const res  = await fetch("/api/admin/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJson<{ error?: string; user?: { role?: string } }>(res);
    setLoading(false);

    if (!res.ok) { setError(data?.error ?? "تعذر تسجيل الدخول"); return; }

    const role = data?.user?.role;
    router.push(role === "teacher" ? "/adminpanel/teacher" : "/adminpanel/superadmin");
  };

  const resetForm = (tab: Tab) => {
    setActiveTab(tab); setError("");
    setForm({ name: "", email: "", password: "" });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{ background: "var(--bg)", fontFamily: "var(--font-body)" }}
    >
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)",
        backgroundSize: "54px 54px",
        opacity: .35,
        WebkitMaskImage: "radial-gradient(70% 60% at 50% 40%,#000,transparent)",
        maskImage: "radial-gradient(70% 60% at 50% 40%,#000,transparent)",
      }} />

      {/* Radial glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 0%,var(--brand-soft) 0%,transparent 55%)" }} />

      {/* Theme toggle */}
      <button
        type="button"
        onClick={cycleTheme}
        aria-label="تبديل السمة"
        className="absolute top-4 left-4 flex items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)] cursor-pointer hover:bg-[var(--border)] transition-colors"
        style={{ width: 38, height: 38 }}
      >
        {isDark ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        )}
      </button>

      {/* Card */}
      <div
        className="relative w-full z-10"
        style={{ maxWidth: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, padding: 40, boxShadow: "var(--shadow-lg)", margin: "0 16px" }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <span
            className="inline-flex items-center justify-center mb-[18px]"
            style={{ width: 64, height: 64, borderRadius: 18, background: "var(--brand)", boxShadow: "0 12px 26px -10px var(--brand-shadow)" }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <h1 style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 28, margin: "0 0 6px", color: "var(--ink)" }}>لوحة الإدارة</h1>
          <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0 }}>منصة الكورسات — Code-UP</p>
        </div>

        {/* Tab selector */}
        <div
          className="flex gap-1 p-1 mb-6"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12 }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => resetForm(tab.id)}
              className="flex-1 cursor-pointer border-none transition-all"
              style={{
                padding: "10px",
                borderRadius: 9,
                fontFamily: "var(--font-body)",
                fontWeight: activeTab === tab.id ? 700 : 600,
                fontSize: 13.5,
                color: activeTab === tab.id ? "#fff" : "var(--ink-2)",
                background: activeTab === tab.id ? "var(--brand)" : "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="mb-5 flex items-center gap-2"
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid var(--danger)", background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13.5 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* Teacher: name */}
          {activeTab === "teacher" && (
            <>
              <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>الاسم</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم المعلم"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 15, marginBottom: 18, outline: "none" }}
              />
            </>
          )}

          {/* Staff: email */}
          {activeTab === "staff_portal" && (
            <>
              <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@example.com"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 15, marginBottom: 18, outline: "none", direction: "ltr" }}
              />
            </>
          )}

          <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>كلمة المرور</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 15, marginBottom: 26, outline: "none" }}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer border-none transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              padding: 15, borderRadius: 12,
              background: "var(--brand)", color: "#fff",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 17,
              boxShadow: "0 12px 26px -10px var(--brand-shadow)",
            }}
          >
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
