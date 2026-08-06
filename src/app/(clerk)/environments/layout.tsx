import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "البيئات الكورسات | منصة Code-UP الكورسات",
  description: "ادخل إلى بيئات كورسات تفاعلية في الرياضيات، الفيزياء، الكيمياء، البرمجة والمزيد في منصة Code-UP الكورسات.",
  openGraph: {
    title: "البيئات الكورسات | منصة Code-UP الكورسات",
    description: "ادخل إلى بيئات كورسات تفاعلية في الرياضيات، الفيزياء، الكيمياء، البرمجة والمزيد في منصة Code-UP الكورسات.",
    url: "https://code-up.tech/environments",
    siteName: "منصة Code-UP",
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
