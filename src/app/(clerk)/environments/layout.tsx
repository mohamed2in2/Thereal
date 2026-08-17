import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بيئات التعلم ومحررات الأكواد التفاعلية | منصة Code-UP التعليمية",
  description: "محرر أكواد مدمج للغات Python و JavaScript وبيئات تفاعلية ذكية في البرمجة والرياضيات والفيزياء والكيمياء لطلاب البكالوريا والثانوية العامة.",
  openGraph: {
    title: "بيئات التعلم ومحررات الأكواد التفاعلية | منصة Code-UP",
    description: "محرر أكواد مدمج وبيئات تدريب تفاعلية بدون برامج خارجية لطلاب البكالوريا والمرحلة الثانوية.",
    url: "https://code-up.tech/environments",
    siteName: "منصة Code-UP التعليمية",
    locale: "ar_EG",
    type: "website",
  },
  alternates: {
    canonical: "https://code-up.tech/environments",
  },
};

export default function EnvironmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
