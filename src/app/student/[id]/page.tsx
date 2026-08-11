"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import Link from "next/link";

interface Profile {
  id: string;
  name: string;
  educationalStage: string | null;
  points: number;
  loginStreak: number;
  rank: number;
  coursesCount: number;
  quizzesPassed: number;
  avgScore: number;
  joinedAt: string;
  referralCode?: string;
}

const STAGE_LABELS: Record<string, string> = {
  sec_1: "أولى بكالوريا",
  sec_2: "ثانية بكالوريا",
};

export default function StudentProfilePage() {
  const { id }  = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [user,    setUser]    = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user) setUser(d.user); })
      .catch(() => {});

    fetch(`/api/student/${id}/profile`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setProfile(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
        <Navbar user={user} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h2 style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginBottom: 8 }}>
              الطالب غير موجود
            </h2>
            <Link href="/" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>العودة للرئيسية</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const stats = [
    { label: "النقاط",          value: profile.points.toLocaleString("ar-EG"),  icon: "⭐" },
    { label: "الترتيب العالمي", value: `#${profile.rank}`,                        icon: "🏆" },
    { label: "سلسلة الالتزام", value: `${profile.loginStreak} يوم`,              icon: "🔥" },
    { label: "الكورسات",        value: profile.coursesCount,                      icon: "📚" },
    { label: "اختبارات ناجحة",  value: profile.quizzesPassed,                     icon: "✅" },
    { label: "متوسط الدرجات",   value: `${profile.avgScore}%`,                    icon: "📊" },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)", fontFamily: "var(--font-body)" }}>
      <Navbar user={user} />

      <main className="flex-1 max-w-[720px] mx-auto w-full px-6 py-14">

        {/* Profile header */}
        <div
          className="rounded-[20px] overflow-hidden mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div style={{ height: 100, background: "linear-gradient(120deg,var(--brand),var(--brand-strong))", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
          </div>
          <div style={{ padding: "0 28px 28px" }}>
            <div className="flex items-end justify-end gap-4" style={{ marginTop: -36, marginBottom: 20 }}>
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 28, margin: 0, color: "var(--ink)" }}>
                  {profile.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 justify-end">
                  {profile.educationalStage && (
                    <span style={{ padding: "4px 12px", borderRadius: 20, background: "var(--brand-soft)", color: "var(--brand)", fontSize: 13, fontWeight: 700 }}>
                      {STAGE_LABELS[profile.educationalStage] ?? profile.educationalStage}
                    </span>
                  )}
                  <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                    عضو منذ {new Date(profile.joinedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
                  </span>
                </div>
              </div>
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 72, height: 72, borderRadius: 18, background: "var(--brand)", border: "4px solid var(--surface)", boxShadow: "var(--shadow)" }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>
                </svg>
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="text-center"
                  style={{ padding: "16px 12px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 20, color: "var(--brand)" }}>{value}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{label}</div>
                </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
