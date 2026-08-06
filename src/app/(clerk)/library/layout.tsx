import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مكتبتي التعليمية | منصة Code-UP التعليمية",
  description: "تصفح الكورسات التي قمت بالتسجيل فيها ومتابعة تقدمك التعليمي على منصة Code-UP.",
  openGraph: {
    title: "مكتبتي التعليمية | منصة Code-UP التعليمية",
    description: "تصفح الكورسات التي قمت بالتسجيل فيها ومتابعة تقدمك التعليمي على منصة Code-UP.",
    url: "https://code-up.tech/library",
    siteName: "منصة Code-UP التعليمية",
    locale: "ar_EG",
    type: "website",
  },
  alternates: {
    canonical: "https://code-up.tech/library",
  },
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
