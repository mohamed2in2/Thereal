import { Metadata } from "next";

export const metadata: Metadata = {
  title: "الخطط والمسارات الدراسية | منصة Code-UP التعليمية | CodeUp Academy",
  description: "تصفح الخطط والمسارات الدراسية المتاحة لتطوير مهاراتك بشكل منظم مع نخبة من أفضل المعلمين على منصة Code-UP.",
  alternates: {
    canonical: "https://code-up.tech/plans",
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
