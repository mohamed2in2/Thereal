import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "لوحة الشرف وتصنيف الأوائل | منصة Code-UP التعليمية",
  description: "لوحة شرف وتصنيف الطلاب الأوائل والمتفوقين على منصة Code-UP. تابع النقاط وأيام الالتزام اليومية (Streaks) وتنافس مع زملائك على الصدارة.",
  alternates: {
    canonical: "https://code-up.tech/leaderboard",
  },
  openGraph: {
    title: "لوحة الشرف وتصنيف الأوائل | منصة Code-UP",
    description: "شاهد قائمة أوائل ومنجزين منصة Code-UP في مختلف المواد والمسارات التعليمية.",
    url: "https://code-up.tech/leaderboard",
    siteName: "منصة Code-UP التعليمية",
    type: "website",
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
