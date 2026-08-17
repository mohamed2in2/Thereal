import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "طرق الدفع والشحن الإلكتروني | منصة Code-UP التعليمية",
  description: "تعرف على طرق الدفع المتاحة على منصة Code-UP: فودافون كاش، انستاباي InstaPay، المحافظ الإلكترونية، وبطاقات الدفع المباشر بأمان فائق وسرعة فورية.",
  alternates: {
    canonical: "https://code-up.tech/payment-methods",
  },
  openGraph: {
    title: "طرق الدفع والشحن الإلكتروني | منصة Code-UP",
    description: "فودافون كاش، انستاباي InstaPay، وكافة المحافظ الإلكترونية لشحن الحساب والاشتراك في كورسات البكالوريا والثانوية العامة.",
    url: "https://code-up.tech/payment-methods",
    siteName: "منصة Code-UP التعليمية",
    type: "website",
  },
};

export default function PaymentMethodsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
