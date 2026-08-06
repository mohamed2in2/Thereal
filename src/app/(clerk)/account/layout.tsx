import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حسابي | منصة Code-UP الكورسات",
  description: "إدارة حسابك الشخصي وتحديث بياناتك التدريبية في منصة Code-UP الكورسات.",
  openGraph: {
    title: "حسابي | منصة Code-UP الكورسات",
    description: "إدارة حسابك الشخصي وتحديث بياناتك التدريبية في منصة Code-UP الكورسات.",
    url: "https://code-up.tech/account",
    siteName: "منصة Code-UP",
    locale: "ar_EG",
    type: "website",
  },
  alternates: {
    canonical: "https://code-up.tech/account",
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
