import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "كورسات منصة Code-UP التعليمية | CodeUp Academy",
  description: "تصفح واكتشف أفضل كورسات الرياضيات والعلوم والبرمجة والتكنولوجيا المتاحة على منصة Code-UP التعليمية للطلاب في مصر.",
  openGraph: {
    title: "كورسات منصة Code-UP التعليمية | CodeUp Academy",
    description: "تصفح واكتشف أفضل كورسات الرياضيات والعلوم والبرمجة والتكنولوجيا المتاحة على منصة Code-UP التعليمية للطلاب في مصر.",
    url: "https://code-up.tech/courses",
    siteName: "منصة Code-UP التعليمية",
    locale: "ar_EG",
    type: "website",
  },
  alternates: {
    canonical: "https://code-up.tech/courses",
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
